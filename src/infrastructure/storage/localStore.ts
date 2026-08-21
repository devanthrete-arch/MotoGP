import type {
  BuildRole,
  DraftPost,
  DraftReport,
  DraftShortlistItem,
  DraftTimelineEntry,
  DraftVehicle,
  FeedbackNote,
  FeedbackStatus,
  FollowState,
  GarageVehicle,
  OwnerPost,
  Profile,
  ReportRecord,
  ShortlistItem,
  SubscriptionSettings,
  DraftTesterRun,
  TesterRun,
  TimelineEntry,
} from "../../core/entities";
import { seedPosts } from "../../core/entities";

const postsKey = "autoflex.web.posts.v1";
const savedKey = "autoflex.web.saved.v1";
const feedbackKey = "autoflex.web.feedback.v1";
const followKey = "autoflex.web.follows.v1";
const garageKey = "autoflex.web.garage.v1";
const timelineKey = "autoflex.web.timeline.v1";
const subscriptionKey = "autoflex.web.subscription.v1";
const profileKey = "autoflex.web.profile.v1";
const cloudOwnerKey = "autoflex.web.cloud-owner.v1";
const reportsKey = "autoflex.web.reports.v1";
const shortlistKey = "autoflex.web.shortlist.v1";
const qaSessionKey = "autoflex.web.qa-session.v1";
const responsiveQaKey = "autoflex.web.responsive-qa.v1";
const productionLaunchKey = "autoflex.web.production-launch.v1";
const productionUrlKey = "autoflex.web.production-url.v1";
const testerRunsKey = "autoflex.web.tester-runs.v1";
const productionOpsKey = "autoflex.web.production-ops.v1";
const localUpdatedAtKey = "autoflex.web.local-updated-at.v1";
const cityFollowsKey = "autoflex.web.city-follows.v1";
const autoflexStorageKeys = [
  postsKey,
  savedKey,
  feedbackKey,
  followKey,
  garageKey,
  timelineKey,
  subscriptionKey,
  profileKey,
  reportsKey,
  shortlistKey,
  qaSessionKey,
  responsiveQaKey,
  productionLaunchKey,
  productionUrlKey,
  testerRunsKey,
  productionOpsKey,
  localUpdatedAtKey,
  cityFollowsKey,
];

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

type StoredFeedbackNote = FeedbackNote | Omit<FeedbackNote, "loopStage"> | Omit<FeedbackNote, "status" | "loopStage">;

const feedbackLoopStageFallback: BuildRole = "Real user";

export type AutoflexBackup = {
  version: 1;
  exportedAt: string;
  data: {
    feedback: FeedbackNote[];
    follows: FollowState;
    garage: GarageVehicle[];
    posts: OwnerPost[];
    profile: Profile;
    productionLaunch: string[];
    productionOps: string[];
    productionUrl: string;
    reports: ReportRecord[];
    responsiveQa: string[];
    saved: string[];
    shortlist: ShortlistItem[];
    subscriptionSettings: SubscriptionSettings;
    testerRuns: TesterRun[];
    timeline: TimelineEntry[];
  };
};

/**
 * A stored value can be valid JSON and still be the wrong shape — a hand-edited
 * key, a half-finished migration, or another app on the same origin. Parsing
 * alone used to hand `"a string"` back as a `ShortlistItem[]`, and the first
 * `.map()` took the whole page down to a blank screen. Compare against the
 * fallback so the wrong shape degrades exactly like unparseable JSON does.
 */
const matchesFallbackShape = <T,>(value: unknown, fallback: T): value is T => {
  if (Array.isArray(fallback)) return Array.isArray(value);
  if (fallback !== null && typeof fallback === "object") {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  if (fallback === null) return true;
  return typeof value === typeof fallback;
};

export const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;

  try {
    const parsed: unknown = JSON.parse(value);
    return matchesFallbackShape(parsed, fallback) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const getBrowserStorage = (): StorageLike | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** Reads see buffered writes, so a read-after-write is never stale. */
const peekPending = <T,>(key: string): { hit: boolean; value?: T } =>
  pendingWrites.has(key) ? { hit: true, value: pendingWrites.get(key) as T } : { hit: false };

export const readStoredJson = <T,>(key: string, fallback: T, storage: StorageLike | null = getBrowserStorage()): T => {
  // A value written this frame is still in the buffer, not yet in storage.
  const buffered = peekPending<T>(key);
  if (buffered.hit) return buffered.value as T;
  if (!storage) return fallback;

  try {
    return safeJsonParse<T>(storage.getItem(key), fallback);
  } catch {
    return fallback;
  }
};

/**
 * Coalesced writes.
 *
 * Every mutation used to `JSON.stringify` a whole collection synchronously, so
 * a burst of edits (typing, dragging a slider, bulk-importing) re-serialised
 * the same array N times on the main thread. Writes are now buffered per key
 * and flushed once per frame, keeping only the last value — the same bytes
 * land in storage, just once instead of N times.
 *
 * Durability is unchanged from the user's point of view: reads go through the
 * buffer, and the buffer is flushed synchronously on `pagehide` and on tab
 * hide, which are the last reliable moments before a browser discards a page.
 */
type SchedulerHost = {
  addEventListener?: (type: string, listener: () => void) => void;
  cancelAnimationFrame?: (handle: number) => void;
  clearTimeout?: (handle: number) => void;
  document?: { visibilityState?: string };
  requestAnimationFrame?: (callback: () => void) => number;
  setTimeout?: (callback: () => void, delay: number) => unknown;
};

/** Host timers/events, read off globalThis so this file compiles without DOM lib. */
const scheduler = globalThis as unknown as SchedulerHost;

const pendingWrites = new Map<string, unknown>();
let flushHandle: number | null = null;

const writeThrough = <T,>(key: string, value: T, storage: StorageLike | null): void => {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked, full, or unavailable in private browsing. Keep the in-memory UI alive.
  }
};

/** Writes every buffered value immediately. Safe to call at any time. */
export const flushStoredJson = (storage: StorageLike | null = getBrowserStorage()): void => {
  if (flushHandle !== null) {
    const cancel = scheduler.cancelAnimationFrame ?? scheduler.clearTimeout;
    cancel?.call(scheduler, flushHandle);
    flushHandle = null;
  }
  if (!pendingWrites.size) return;
  const entries = [...pendingWrites.entries()];
  pendingWrites.clear();
  for (const [key, value] of entries) writeThrough(key, value, storage);
};

const scheduleFlush = (storage: StorageLike | null): void => {
  if (flushHandle !== null) return;
  const run = () => {
    flushHandle = null;
    flushStoredJson(storage);
  };
  flushHandle = scheduler.requestAnimationFrame
    ? scheduler.requestAnimationFrame(run)
    : (scheduler.setTimeout?.(run, 16) as unknown as number);
};

// pagehide covers reload, navigation and bfcache; visibilitychange covers the
// mobile case where a tab is backgrounded and may never fire pagehide.
// Accessed through globalThis so this module also compiles for non-DOM targets.
if (scheduler.addEventListener) {
  scheduler.addEventListener("pagehide", () => flushStoredJson());
  scheduler.addEventListener("visibilitychange", () => {
    if (scheduler.document?.visibilityState === "hidden") flushStoredJson();
  });
}

export const writeStoredJson = <T,>(key: string, value: T, storage: StorageLike | null = getBrowserStorage()): void => {
  if (!storage) return;
  pendingWrites.set(key, value);
  scheduleFlush(storage);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const buildAutoflexBackup = (exportedAt = new Date().toISOString()): AutoflexBackup => ({
  data: {
    feedback: loadFeedback(),
    follows: loadFollows(),
    garage: loadGarage(),
    posts: loadPosts(),
    profile: loadProfile(),
    productionLaunch: [...loadProductionLaunch()],
    productionOps: [...loadProductionOps()],
    productionUrl: loadProductionUrl(),
    reports: loadReports(),
    responsiveQa: [...loadResponsiveQa()],
    saved: [...loadSaved()],
    shortlist: loadShortlist(),
    subscriptionSettings: loadSubscriptionSettings(),
    testerRuns: loadTesterRuns(),
    timeline: loadTimeline(),
  },
  exportedAt,
  version: 1,
});

export const parseAutoflexBackup = (raw: string): AutoflexBackup | null => {
  const parsed = safeJsonParse<unknown>(raw, null);
  if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.exportedAt !== "string" || !isRecord(parsed.data)) {
    return null;
  }

  return {
    data: {
      feedback: normalizeFeedbackNotes(Array.isArray(parsed.data.feedback) ? (parsed.data.feedback as StoredFeedbackNote[]) : []),
      follows: isRecord(parsed.data.follows)
        ? (parsed.data.follows as FollowState)
        : {
            models: [],
            topics: [],
          },
      garage: Array.isArray(parsed.data.garage) ? (parsed.data.garage as GarageVehicle[]) : [],
      posts: Array.isArray(parsed.data.posts) ? (parsed.data.posts as OwnerPost[]) : [],
      profile: isRecord(parsed.data.profile)
        ? (parsed.data.profile as Profile)
        : {
            city: "",
            displayName: "",
            garageRole: "Owner",
          },
      productionLaunch: Array.isArray(parsed.data.productionLaunch)
        ? parsed.data.productionLaunch.filter((item): item is string => typeof item === "string")
        : [],
      productionOps: Array.isArray(parsed.data.productionOps)
        ? parsed.data.productionOps.filter((item): item is string => typeof item === "string")
        : [],
      productionUrl: typeof parsed.data.productionUrl === "string" ? parsed.data.productionUrl : "",
      reports: Array.isArray(parsed.data.reports) ? (parsed.data.reports as ReportRecord[]) : [],
      responsiveQa: Array.isArray(parsed.data.responsiveQa)
        ? parsed.data.responsiveQa.filter((item): item is string => typeof item === "string")
        : [],
      saved: Array.isArray(parsed.data.saved) ? parsed.data.saved.filter((item): item is string => typeof item === "string") : [],
      shortlist: Array.isArray(parsed.data.shortlist) ? (parsed.data.shortlist as ShortlistItem[]) : [],
      subscriptionSettings: isRecord(parsed.data.subscriptionSettings)
        ? (parsed.data.subscriptionSettings as SubscriptionSettings)
        : {
            browserAlerts: false,
            emailDigest: true,
            quietHours: true,
          },
      testerRuns: Array.isArray(parsed.data.testerRuns) ? (parsed.data.testerRuns as TesterRun[]) : [],
      timeline: Array.isArray(parsed.data.timeline) ? (parsed.data.timeline as TimelineEntry[]) : [],
    },
    exportedAt: parsed.exportedAt,
    version: 1,
  };
};

export const restoreAutoflexBackup = (backup: AutoflexBackup): void => {
  saveFeedback(backup.data.feedback);
  saveFollows(backup.data.follows);
  saveGarage(backup.data.garage);
  savePosts(backup.data.posts);
  saveProfile(backup.data.profile);
  saveProductionLaunch(new Set(backup.data.productionLaunch));
  saveProductionOps(new Set(backup.data.productionOps));
  saveProductionUrl(backup.data.productionUrl);
  saveReports(backup.data.reports);
  saveResponsiveQa(new Set(backup.data.responsiveQa));
  saveSaved(new Set(backup.data.saved));
  saveShortlist(backup.data.shortlist);
  saveSubscriptionSettings(backup.data.subscriptionSettings);
  saveTesterRuns(backup.data.testerRuns);
  saveTimeline(backup.data.timeline);
  markLocalUpdated();
};

export const clearAutoflexData = (storage?: Pick<Storage, "removeItem"> | null): void => {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return;
    autoflexStorageKeys.forEach((key) => target.removeItem(key));
  } catch {
    // A blocked browser store should not prevent the current screen from remaining usable.
  }
};

export const loadPosts = (): OwnerPost[] => {
  const posts = readStoredJson<OwnerPost[]>(postsKey, seedPosts);
  return posts.sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
};

export const savePosts = (posts: OwnerPost[]): void => {
  writeStoredJson(postsKey, posts);
};

export const createPost = (draft: DraftPost): OwnerPost => ({
  ...draft,
  id: `${draft.brand}-${draft.model}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  createdAt: new Date().toISOString(),
  helpful: 0,
  fixesConfirmed: 0,
  comments: [],
});

export const loadSaved = (): Set<string> => new Set(readStoredJson<string[]>(savedKey, []));

export const saveSaved = (saved: Set<string>): void => {
  writeStoredJson(savedKey, [...saved]);
};

export const loadQaSession = (): Set<string> => new Set(readStoredJson<string[]>(qaSessionKey, []));

export const saveQaSession = (checkedIds: Set<string>): void => {
  writeStoredJson(qaSessionKey, [...checkedIds]);
};

export const loadResponsiveQa = (): Set<string> => new Set(readStoredJson<string[]>(responsiveQaKey, []));

export const saveResponsiveQa = (checkedIds: Set<string>): void => {
  writeStoredJson(responsiveQaKey, [...checkedIds]);
};

export const loadProductionLaunch = (): Set<string> => new Set(readStoredJson<string[]>(productionLaunchKey, []));

export const saveProductionLaunch = (checkedIds: Set<string>): void => {
  writeStoredJson(productionLaunchKey, [...checkedIds]);
};

export const loadProductionOps = (): Set<string> => new Set(readStoredJson<string[]>(productionOpsKey, []));

export const saveProductionOps = (checkedIds: Set<string>): void => {
  writeStoredJson(productionOpsKey, [...checkedIds]);
};

export const loadProductionUrl = (): string => readStoredJson<string>(productionUrlKey, "");

export const saveProductionUrl = (url: string): void => {
  writeStoredJson(productionUrlKey, url);
};

export const loadTesterRuns = (): TesterRun[] =>
  readStoredJson<TesterRun[]>(testerRunsKey, []).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

export const saveTesterRuns = (runs: TesterRun[]): void => {
  writeStoredJson(testerRunsKey, runs);
};

export const createTesterRun = (draft: DraftTesterRun): TesterRun => ({
  ...draft,
  id: `tester-run-${Date.now()}`,
  createdAt: new Date().toISOString(),
});

export const normalizeFeedbackNotes = (notes: StoredFeedbackNote[]): FeedbackNote[] =>
  notes
    .map((note) => ({
      loopStage: feedbackLoopStageFallback,
      status: "New" as const,
      ...note,
    }))
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

export const loadFeedback = (): FeedbackNote[] => normalizeFeedbackNotes(readStoredJson<StoredFeedbackNote[]>(feedbackKey, []));

export const saveFeedback = (feedback: FeedbackNote[]): void => {
  writeStoredJson(feedbackKey, feedback);
};

export const addFeedback = (message: string): FeedbackNote[] => {
  const next = [
    {
      id: `feedback-${Date.now()}`,
      loopStage: feedbackLoopStageFallback,
      message,
      status: "New" as const,
      createdAt: new Date().toISOString(),
    },
    ...loadFeedback(),
  ];
  saveFeedback(next);
  return next;
};

export const updateFeedbackStatus = (
  feedback: FeedbackNote[],
  feedbackId: string,
  status: FeedbackStatus,
): FeedbackNote[] => feedback.map((note) => (note.id === feedbackId ? { ...note, status } : note));

export const updateFeedbackLoopStage = (
  feedback: FeedbackNote[],
  feedbackId: string,
  loopStage: BuildRole,
): FeedbackNote[] => feedback.map((note) => (note.id === feedbackId ? { ...note, loopStage } : note));

export const loadFollows = (): FollowState =>
  readStoredJson<FollowState>(followKey, { models: [], topics: [] });

export const saveFollows = (follows: FollowState): void => {
  writeStoredJson(followKey, follows);
};

/**
 * A new visitor starts with an empty garage.
 *
 * The seed vehicle used to be the default, so every first-time user opened
 * AutoFlex already "owning" a Tata Nexon they had never entered — and the app
 * could not distinguish a genuine first run from a returning one, because
 * `garage.length === 0` was never true. `seedGarage` is kept for tests and
 * demos; it is no longer what a real person sees.
 */
export const loadGarage = (): GarageVehicle[] => readStoredJson<GarageVehicle[]>(garageKey, []);

export const saveGarage = (garage: GarageVehicle[]): void => {
  writeStoredJson(garageKey, garage);
};

export const createVehicle = (draft: DraftVehicle): GarageVehicle => ({
  ...draft,
  id: `${draft.brand}-${draft.model}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
});

export const loadTimeline = (): TimelineEntry[] =>
  // Empty too: the seeded timeline belonged to the seeded vehicle, so keeping
  // it would leave service records pointing at a car that no longer exists.
  readStoredJson<TimelineEntry[]>(timelineKey, []).sort(
    (first, second) => Date.parse(second.happenedOn) - Date.parse(first.happenedOn),
  );

export const saveTimeline = (entries: TimelineEntry[]): void => {
  writeStoredJson(timelineKey, entries);
};

export const createTimelineEntry = (draft: DraftTimelineEntry): TimelineEntry => ({
  ...draft,
  id: `${draft.vehicleId}-${draft.kind}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
});

export const loadSubscriptionSettings = (): SubscriptionSettings =>
  readStoredJson<SubscriptionSettings>(subscriptionKey, {
    emailDigest: true,
    browserAlerts: false,
    quietHours: true,
  });

export const saveSubscriptionSettings = (settings: SubscriptionSettings): void => {
  writeStoredJson(subscriptionKey, settings);
};

export const loadProfile = (): Profile =>
  readStoredJson<Profile>(profileKey, {
    city: "",
    displayName: "",
    garageRole: "Owner",
  });

export const saveProfile = (profile: Profile): void => {
  writeStoredJson(profileKey, profile);
};

export const loadReports = (): ReportRecord[] => readStoredJson<ReportRecord[]>(reportsKey, []);

export const saveReports = (reports: ReportRecord[]): void => {
  writeStoredJson(reportsKey, reports);
};

export const createReport = (draft: DraftReport): ReportRecord => ({
  ...draft,
  id: `report-${draft.postId}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  status: "Open",
  createdAt: new Date().toISOString(),
});

export const loadShortlist = (): ShortlistItem[] => readStoredJson<ShortlistItem[]>(shortlistKey, []);

export const saveShortlist = (items: ShortlistItem[]): void => {
  writeStoredJson(shortlistKey, items);
};

export const createShortlistItem = (draft: DraftShortlistItem): ShortlistItem => ({
  ...draft,
  id: `shortlist-${draft.brand}-${draft.model}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
});

/* -------------------------------------------------------------------------- */
/* Last-local-write bookkeeping                                                */
/* -------------------------------------------------------------------------- */

/**
 * ISO timestamp of the most recent local mutation.
 *
 * `syncAllHosted` treats a hosted record as the winner only when its
 * `updated_at` is strictly newer than this clock, so every mutating persist
 * handler bumps it. A missing or unparseable value is reported as `""`, which
 * makes hosted always win — safe, because the hosted copy is itself derived
 * from a previous push of this device's data.
 */
export const loadLocalUpdatedAt = (storage?: StorageLike | null): string => {
  const stored = readStoredJson<unknown>(localUpdatedAtKey, "", storage === undefined ? undefined : storage);
  if (typeof stored !== "string" || !stored.trim()) return "";
  return Number.isNaN(Date.parse(stored)) ? "" : stored;
};

/** Records a local write and returns the timestamp that was stored. */
export const markLocalUpdated = (
  at: string = new Date().toISOString(),
  storage?: StorageLike | null,
): string => {
  const stamp = Number.isNaN(Date.parse(at)) ? new Date().toISOString() : at;
  writeStoredJson(localUpdatedAtKey, stamp, storage === undefined ? undefined : storage);
  return stamp;
};

export const clearLocalUpdatedAt = (storage?: StorageLike | null): void => {
  writeStoredJson(localUpdatedAtKey, "", storage === undefined ? undefined : storage);
};

/* -------------------------------------------------------------------------- */
/* City follows (hosted `city_follows` mirror; kept out of the v1 backup shape) */
/* -------------------------------------------------------------------------- */

export const loadCityFollows = (): Set<string> => new Set(readStoredJson<string[]>(cityFollowsKey, []));

export const saveCityFollows = (slugs: Set<string>): void => {
  writeStoredJson(cityFollowsKey, [...slugs]);
};

/**
 * Which signed-in account this device's data belongs to.
 *
 * Guards against one account's hosted backup silently overwriting another
 * account's data on a shared device.
 */
export const readCloudOwner = (): string | null => readStoredJson<string | null>(cloudOwnerKey, null);

export const saveCloudOwner = (userId: string | null): void => {
  writeStoredJson(cloudOwnerKey, userId);
};
