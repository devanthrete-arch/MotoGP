import type {
  FeedbackNote,
  FollowState,
  GarageVehicle,
  OwnerPost,
  Profile,
  ReportRecord,
  ShortlistItem,
  SubscriptionSettings,
  TimelineEntry,
} from "../../core/entities";
import { nowIso, timestampOf } from "./kernel/coerce";
import {
  mergePostCollections,
  postRowToLocal,
  postToRow,
  reportRowToLocal,
  reportToRow,
  selectOwnerPostRows,
  selectReportRows,
  selectSavedPostIds,
} from "./community";
import { feedbackRowToLocal, feedbackToRow, selectFeedbackRows, sortFeedbackByRecency } from "./feedback";
import { followRowToLocal, followStateToRow, mergeFollowStates, selectFollowRow } from "./follows";
import {
  selectTimelineRows,
  selectVehicleRows,
  timelineEntryToRow,
  timelineRowToLocal,
  vehicleRowToLocal,
  vehicleToRow,
} from "./garage";
import {
  defaultSubscriptionSettings,
  selectSubscriptionRow,
  subscriptionRowToLocal,
  subscriptionToRow,
} from "./notifications";
import { emptyProfile, profileRowToLocal, profileToRow, selectProfileRow } from "./profile";
import { type HostedResult, runHostedForUser, unwrapWrite } from "./kernel/result";
import { selectShortlistRows, shortlistItemToRow, shortlistRowToLocal } from "./shortlist";

/**
 * The slice of the local workspace that has a hosted mirror.
 * `AutoflexBackup["data"]` is structurally assignable to this, so the app can
 * pass `buildAutoflexBackup().data` straight in.
 */
export type HostedWorkspaceSnapshot = {
  feedback: FeedbackNote[];
  follows: FollowState;
  garage: GarageVehicle[];
  posts: OwnerPost[];
  profile: Profile;
  reports: ReportRecord[];
  saved: string[];
  shortlist: ShortlistItem[];
  subscriptionSettings: SubscriptionSettings;
  timeline: TimelineEntry[];
};

export const hostedSyncDomains = [
  "profile",
  "follows",
  "subscription",
  "posts",
  "saved",
  "reports",
  "garage",
  "timeline",
  "shortlist",
  "feedback",
] as const;

export type HostedSyncDomain = (typeof hostedSyncDomains)[number];

export type HostedDomainReport = {
  domain: HostedSyncDomain;
  status: "merged" | "skipped" | "failed";
  pulled: number;
  pushed: number;
  detail: string;
};

export type HostedSyncOutcome = {
  workspace: HostedWorkspaceSnapshot;
  reports: HostedDomainReport[];
  syncedAt: string | null;
};

export type SyncAllHostedOptions = {
  /**
   * ISO timestamp of the last local write. Records whose hosted `updated_at`
   * is newer than this win; everything else is treated as a local win and
   * pushed. Omit it (or pass an old value) to make local always win.
   */
  localUpdatedAt?: string | null;
};

/* -------------------------------------------------------------------------- */
/* Pure merge helpers                                                          */
/* -------------------------------------------------------------------------- */

export type MergeOutcome<Value> = {
  merged: Value[];
  toPush: Value[];
  pulled: number;
};

/**
 * Last-write-wins merge of a keyed collection.
 * A hosted record wins only when its `updated_at` is strictly newer than the
 * local write clock; otherwise the local record wins and is queued for push.
 */
export const mergeKeyedCollection = <Value extends { id: string }>(
  local: Value[],
  hosted: { value: Value; updatedAt: string }[],
  localUpdatedAt: number,
): MergeOutcome<Value> => {
  const localById = new Map(local.map((value) => [value.id, value]));
  const hostedById = new Map(hosted.map((entry) => [entry.value.id, entry]));
  const merged: Value[] = [];
  const toPush: Value[] = [];
  let pulled = 0;

  local.forEach((value) => {
    const hostedEntry = hostedById.get(value.id);
    if (hostedEntry && timestampOf(hostedEntry.updatedAt) > localUpdatedAt) {
      merged.push(hostedEntry.value);
      pulled += 1;
      return;
    }
    merged.push(value);
    toPush.push(value);
  });

  hosted.forEach((entry) => {
    if (localById.has(entry.value.id)) return;
    merged.push(entry.value);
    pulled += 1;
  });

  return { merged, pulled, toPush };
};

/** Singleton merge (profile, follows, subscription settings). */
export const mergeSingleton = <Value>(
  local: Value,
  hosted: { value: Value; updatedAt: string } | null,
  localUpdatedAt: number,
): { merged: Value; pushNeeded: boolean; pulled: number } => {
  if (hosted && timestampOf(hosted.updatedAt) > localUpdatedAt) {
    return { merged: hosted.value, pulled: 1, pushNeeded: false };
  }
  return { merged: local, pulled: 0, pushNeeded: true };
};

export const mergeStringSets = (local: string[], hosted: string[]): string[] => [
  ...new Set([...local.filter(Boolean), ...hosted.filter(Boolean)]),
];

const skippedReports = (detail: string): HostedDomainReport[] =>
  hostedSyncDomains.map((domain) => ({ detail, domain, pulled: 0, pushed: 0, status: "skipped" as const }));

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : "The hosted request failed.";

/* -------------------------------------------------------------------------- */
/* Orchestrator                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Pulls every hosted domain, merges last-write-wins against the local snapshot,
 * pushes what local won, and returns the merged workspace plus a per-domain
 * report.
 *
 * The input snapshot is returned unchanged when hosted sync is unconfigured,
 * the browser is offline, or no user is signed in. A single failing domain
 * degrades to the local copy for that domain only; the rest still sync.
 */
export const syncAllHosted = async (
  userId: string | null | undefined,
  snapshot: HostedWorkspaceSnapshot,
  options: SyncAllHostedOptions = {},
): Promise<HostedResult<HostedSyncOutcome>> => {
  const localUpdatedAt = timestampOf(options.localUpdatedAt);
  const fallback: HostedSyncOutcome = {
    reports: skippedReports("Hosted sync is unavailable, so the local copy was kept."),
    syncedAt: null,
    workspace: snapshot,
  };

  return runHostedForUser<HostedSyncOutcome>(userId, fallback, async (client, id) => {
    const workspace: HostedWorkspaceSnapshot = { ...snapshot };
    const reports: HostedDomainReport[] = [];

    const runDomain = async (
      domain: HostedSyncDomain,
      run: () => Promise<{ pulled: number; pushed: number; detail?: string }>,
    ): Promise<void> => {
      try {
        const outcome = await run();
        reports.push({
          detail: outcome.detail ?? "Merged with the hosted copy.",
          domain,
          pulled: outcome.pulled,
          pushed: outcome.pushed,
          status: "merged",
        });
      } catch (error) {
        reports.push({ detail: describe(error), domain, pulled: 0, pushed: 0, status: "failed" });
      }
    };

    await runDomain("profile", async () => {
      const row = await selectProfileRow(client, id);
      const merge = mergeSingleton<Profile>(
        snapshot.profile ?? emptyProfile,
        row ? { updatedAt: row.updated_at, value: profileRowToLocal(row) } : null,
        localUpdatedAt,
      );
      workspace.profile = merge.merged;
      if (merge.pushNeeded) {
        unwrapWrite(await client.from("profiles").upsert(profileToRow(id, merge.merged), { onConflict: "user_id" }));
      }
      return { pulled: merge.pulled, pushed: merge.pushNeeded ? 1 : 0 };
    });

    await runDomain("follows", async () => {
      const row = await selectFollowRow(client, id);
      const merge = mergeSingleton<FollowState>(
        snapshot.follows ?? { models: [], topics: [] },
        row ? { updatedAt: row.updated_at, value: followRowToLocal(row) } : null,
        localUpdatedAt,
      );
      // Follows are additive: never silently drop a followed model or topic.
      workspace.follows = row ? mergeFollowStates(merge.merged, followRowToLocal(row)) : merge.merged;
      unwrapWrite(await client.from("follows").upsert(followStateToRow(id, workspace.follows), { onConflict: "user_id" }));
      return { detail: "Model and topic follows merged additively.", pulled: merge.pulled, pushed: 1 };
    });

    await runDomain("subscription", async () => {
      const row = await selectSubscriptionRow(client, id);
      const merge = mergeSingleton<SubscriptionSettings>(
        snapshot.subscriptionSettings ?? defaultSubscriptionSettings,
        row ? { updatedAt: row.updated_at, value: subscriptionRowToLocal(row) } : null,
        localUpdatedAt,
      );
      workspace.subscriptionSettings = merge.merged;
      if (merge.pushNeeded) {
        unwrapWrite(
          await client
            .from("subscription_settings")
            .upsert(subscriptionToRow(id, merge.merged), { onConflict: "user_id" }),
        );
      }
      return { pulled: merge.pulled, pushed: merge.pushNeeded ? 1 : 0 };
    });

    await runDomain("posts", async () => {
      // Comment bodies are intentionally NOT pulled here: syncing the feed once
      // used to scan the entire post_comments table. Bodies load per post when
      // a detail pane opens; the card only needs `comment_count`.
      const postRows = await selectOwnerPostRows(client);
      const hostedPosts = postRows.map((row) => postRowToLocal(row, []));
      const hostedIds = new Set(hostedPosts.map((post) => post.id));
      workspace.posts = mergePostCollections(snapshot.posts ?? [], hostedPosts);
      // Only push posts that do not exist hosted yet: updating another author's
      // row is blocked by RLS and would fail the whole domain.
      const toPush = (snapshot.posts ?? []).filter((post) => !hostedIds.has(post.id));
      if (toPush.length) {
        unwrapWrite(
          await client.from("owner_posts").upsert(toPush.map((post) => postToRow(id, post)), { onConflict: "id" }),
        );
      }
      return { pulled: hostedPosts.length, pushed: toPush.length };
    });

    await runDomain("saved", async () => {
      const hostedSaved = await selectSavedPostIds(client, id);
      const merged = mergeStringSets(snapshot.saved ?? [], hostedSaved);
      workspace.saved = merged;
      const toPush = merged.filter((postId) => !hostedSaved.includes(postId));
      if (toPush.length) {
        unwrapWrite(
          await client
            .from("saved_posts")
            .upsert(toPush.map((postId) => ({ post_id: postId, user_id: id })), { onConflict: "user_id,post_id" }),
        );
      }
      return { detail: "Saved notes merged additively.", pulled: hostedSaved.length, pushed: toPush.length };
    });

    await runDomain("reports", async () => {
      const rows = await selectReportRows(client, id);
      const merge = mergeKeyedCollection<ReportRecord>(
        snapshot.reports ?? [],
        rows.map((row) => ({ updatedAt: row.updated_at, value: reportRowToLocal(row) })),
        localUpdatedAt,
      );
      workspace.reports = merge.merged;
      if (merge.toPush.length) {
        unwrapWrite(
          await client
            .from("reports")
            .upsert(merge.toPush.map((report) => reportToRow(id, report)), { onConflict: "id" }),
        );
      }
      return { pulled: merge.pulled, pushed: merge.toPush.length };
    });

    await runDomain("garage", async () => {
      const rows = await selectVehicleRows(client, id);
      const merge = mergeKeyedCollection<GarageVehicle>(
        snapshot.garage ?? [],
        rows.map((row) => ({ updatedAt: row.updated_at, value: vehicleRowToLocal(row) })),
        localUpdatedAt,
      );
      workspace.garage = merge.merged;
      if (merge.toPush.length) {
        unwrapWrite(
          await client
            .from("garage_vehicles")
            .upsert(merge.toPush.map((vehicle) => vehicleToRow(id, vehicle)), { onConflict: "id" }),
        );
      }
      return { pulled: merge.pulled, pushed: merge.toPush.length };
    });

    await runDomain("timeline", async () => {
      const rows = await selectTimelineRows(client, id);
      const merge = mergeKeyedCollection<TimelineEntry>(
        snapshot.timeline ?? [],
        rows.map((row) => ({ updatedAt: row.updated_at, value: timelineRowToLocal(row) })),
        localUpdatedAt,
      );
      workspace.timeline = merge.merged;
      // Timeline rows are FK-bound to a vehicle that must already exist hosted.
      const vehicleIds = new Set(workspace.garage.map((vehicle) => vehicle.id));
      const toPush = merge.toPush.filter((entry) => vehicleIds.has(entry.vehicleId));
      if (toPush.length) {
        unwrapWrite(
          await client
            .from("timeline_entries")
            .upsert(toPush.map((entry) => timelineEntryToRow(id, entry)), { onConflict: "id" }),
        );
      }
      return { pulled: merge.pulled, pushed: toPush.length };
    });

    await runDomain("shortlist", async () => {
      const rows = await selectShortlistRows(client, id);
      const merge = mergeKeyedCollection<ShortlistItem>(
        snapshot.shortlist ?? [],
        rows.map((row) => ({ updatedAt: row.updated_at, value: shortlistRowToLocal(row) })),
        localUpdatedAt,
      );
      workspace.shortlist = merge.merged;
      if (merge.toPush.length) {
        unwrapWrite(
          await client
            .from("shortlist_items")
            .upsert(merge.toPush.map((item) => shortlistItemToRow(id, item)), { onConflict: "id" }),
        );
      }
      return { pulled: merge.pulled, pushed: merge.toPush.length };
    });

    await runDomain("feedback", async () => {
      const rows = await selectFeedbackRows(client, id);
      const merge = mergeKeyedCollection<FeedbackNote>(
        snapshot.feedback ?? [],
        rows.map((row) => ({ updatedAt: row.updated_at, value: feedbackRowToLocal(row) })),
        localUpdatedAt,
      );
      workspace.feedback = sortFeedbackByRecency(merge.merged);
      if (merge.toPush.length) {
        unwrapWrite(
          await client
            .from("feedback_entries")
            .upsert(merge.toPush.map((note) => feedbackToRow(id, note)), { onConflict: "id" }),
        );
      }
      return { pulled: merge.pulled, pushed: merge.toPush.length };
    });

    return { reports, syncedAt: nowIso(), workspace };
  });
};
