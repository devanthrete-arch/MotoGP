import { type Dispatch, type RefObject, type SetStateAction } from "react";
import {
  type DraftTimelineEntry,
  type FollowState,
  type GarageVehicle,
  type OwnerPost,
  type Profile,
  type ReportRecord,
  type ShortlistItem,
  type SubscriptionSettings,
  type TimelineEntry,
} from "../../core";
import {
  markLocalUpdated,
  saveFollows,
  saveGarage,
  savePosts,
  saveProfile,
  saveReports,
  saveShortlist,
  saveSubscriptionSettings,
  saveTimeline,
} from "../../infrastructure/storage/localStore";
import {
  saveHostedFollows,
  saveHostedProfile,
  saveHostedSubscriptionSettings,
  syncHostedCostsFromTimeline,
  upsertHostedPosts,
  upsertHostedReports,
  upsertHostedShortlistItems,
  upsertHostedTimelineEntries,
  upsertHostedVehicles,
} from "../../infrastructure/hosted";
import { type CloudUser } from "../../infrastructure/supabase/auth";

/**
 * The local-first write policy, in one place.
 *
 * Every mutation in the app goes through one of these: React state and
 * localStorage are written first and unconditionally, the last-local-write
 * clock is stamped, and only then is a fire-and-forget hosted mirror attempted.
 * That ordering is the contract that makes the app work with no network, no
 * session and no Supabase configuration, so it stays at the composition root
 * rather than being duplicated per feature.
 */
export function usePersistence({
  cloudUserRef,
  localUpdatedAtRef,
  setFollows,
  setGarage,
  setPosts,
  setProfile,
  setReports,
  setShortlist,
  setSubscriptionSettings,
  setTimeline,
  setTimelineDraft,
  timelineDraft,
}: {
  cloudUserRef: RefObject<CloudUser | null>;
  localUpdatedAtRef: RefObject<string>;
  setFollows: Dispatch<SetStateAction<FollowState>>;
  setGarage: Dispatch<SetStateAction<GarageVehicle[]>>;
  setPosts: Dispatch<SetStateAction<OwnerPost[]>>;
  setProfile: Dispatch<SetStateAction<Profile>>;
  setReports: Dispatch<SetStateAction<ReportRecord[]>>;
  setShortlist: Dispatch<SetStateAction<ShortlistItem[]>>;
  setSubscriptionSettings: Dispatch<SetStateAction<SubscriptionSettings>>;
  setTimeline: Dispatch<SetStateAction<TimelineEntry[]>>;
  setTimelineDraft: Dispatch<SetStateAction<DraftTimelineEntry>>;
  timelineDraft: DraftTimelineEntry;
}) {
  /**
   * Stamps a local mutation and mirrors it to the hosted tables.
   *
   * State and localStorage are written first and unconditionally, so behaviour
   * is identical with no network, no session, or no Supabase configuration.
   * The hosted push is fire-and-forget and cannot throw.
   */
  const noteLocalWrite = (push?: (userId: string) => void): void => {
    localUpdatedAtRef.current = markLocalUpdated();
    const userId = cloudUserRef.current?.id;
    if (userId && push) push(userId);
  };

  const persistPosts = (nextPosts: OwnerPost[]) => {
    setPosts(nextPosts);
    savePosts(nextPosts);
    noteLocalWrite((userId) => void upsertHostedPosts(userId, nextPosts));
  };

  const persistFollows = (nextFollows: FollowState) => {
    setFollows(nextFollows);
    saveFollows(nextFollows);
    noteLocalWrite((userId) => void saveHostedFollows(userId, nextFollows));
  };

  const persistSubscriptionSettings = (nextSettings: SubscriptionSettings) => {
    setSubscriptionSettings(nextSettings);
    saveSubscriptionSettings(nextSettings);
    noteLocalWrite((userId) => void saveHostedSubscriptionSettings(userId, nextSettings));
  };

  const persistProfile = (nextProfile: Profile) => {
    setProfile(nextProfile);
    saveProfile(nextProfile);
    noteLocalWrite((userId) => void saveHostedProfile(userId, nextProfile));
  };

  const persistReports = (nextReports: ReportRecord[]) => {
    setReports(nextReports);
    saveReports(nextReports);
    noteLocalWrite((userId) => void upsertHostedReports(userId, nextReports));
  };

  const persistShortlist = (nextShortlist: ShortlistItem[]) => {
    setShortlist(nextShortlist);
    saveShortlist(nextShortlist);
    noteLocalWrite((userId) => void upsertHostedShortlistItems(userId, nextShortlist));
  };

  const persistGarage = (nextGarage: GarageVehicle[]) => {
    setGarage(nextGarage);
    saveGarage(nextGarage);
    noteLocalWrite((userId) => void upsertHostedVehicles(userId, nextGarage));
    if (!timelineDraft.vehicleId && nextGarage[0]) {
      setTimelineDraft({ ...timelineDraft, vehicleId: nextGarage[0].id });
    }
  };

  const persistTimeline = (nextTimeline: TimelineEntry[]) => {
    setTimeline(nextTimeline);
    saveTimeline(nextTimeline);
    noteLocalWrite((userId) => {
      void upsertHostedTimelineEntries(userId, nextTimeline);
      void syncHostedCostsFromTimeline(userId, nextTimeline);
    });
  };

  return {
    noteLocalWrite,
    persistFollows,
    persistGarage,
    persistPosts,
    persistProfile,
    persistReports,
    persistShortlist,
    persistSubscriptionSettings,
    persistTimeline,
  };
}
