import type {
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
  TimelineEntry,
} from "./domain";
import { seedGarage, seedPosts, seedTimeline } from "./domain";

const postsKey = "autoflex.web.posts.v1";
const savedKey = "autoflex.web.saved.v1";
const feedbackKey = "autoflex.web.feedback.v1";
const followKey = "autoflex.web.follows.v1";
const garageKey = "autoflex.web.garage.v1";
const timelineKey = "autoflex.web.timeline.v1";
const subscriptionKey = "autoflex.web.subscription.v1";
const profileKey = "autoflex.web.profile.v1";
const reportsKey = "autoflex.web.reports.v1";
const shortlistKey = "autoflex.web.shortlist.v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

type StoredFeedbackNote = FeedbackNote | Omit<FeedbackNote, "status">;

export type AutoflexBackup = {
  version: 1;
  exportedAt: string;
  data: {
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
};

export const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
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

export const readStoredJson = <T,>(key: string, fallback: T, storage: StorageLike | null = getBrowserStorage()): T => {
  if (!storage) return fallback;

  try {
    return safeJsonParse<T>(storage.getItem(key), fallback);
  } catch {
    return fallback;
  }
};

export const writeStoredJson = <T,>(key: string, value: T, storage: StorageLike | null = getBrowserStorage()): void => {
  if (!storage) return;

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked, full, or unavailable in private browsing. Keep the in-memory UI alive.
  }
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
    reports: loadReports(),
    saved: [...loadSaved()],
    shortlist: loadShortlist(),
    subscriptionSettings: loadSubscriptionSettings(),
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
      reports: Array.isArray(parsed.data.reports) ? (parsed.data.reports as ReportRecord[]) : [],
      saved: Array.isArray(parsed.data.saved) ? parsed.data.saved.filter((item): item is string => typeof item === "string") : [],
      shortlist: Array.isArray(parsed.data.shortlist) ? (parsed.data.shortlist as ShortlistItem[]) : [],
      subscriptionSettings: isRecord(parsed.data.subscriptionSettings)
        ? (parsed.data.subscriptionSettings as SubscriptionSettings)
        : {
            browserAlerts: false,
            emailDigest: true,
            quietHours: true,
          },
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
  saveReports(backup.data.reports);
  saveSaved(new Set(backup.data.saved));
  saveShortlist(backup.data.shortlist);
  saveSubscriptionSettings(backup.data.subscriptionSettings);
  saveTimeline(backup.data.timeline);
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

export const normalizeFeedbackNotes = (notes: StoredFeedbackNote[]): FeedbackNote[] =>
  notes
    .map((note) => ({
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

export const loadFollows = (): FollowState =>
  readStoredJson<FollowState>(followKey, { models: [], topics: [] });

export const saveFollows = (follows: FollowState): void => {
  writeStoredJson(followKey, follows);
};

export const loadGarage = (): GarageVehicle[] => readStoredJson<GarageVehicle[]>(garageKey, seedGarage);

export const saveGarage = (garage: GarageVehicle[]): void => {
  writeStoredJson(garageKey, garage);
};

export const createVehicle = (draft: DraftVehicle): GarageVehicle => ({
  ...draft,
  id: `${draft.brand}-${draft.model}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
});

export const loadTimeline = (): TimelineEntry[] =>
  readStoredJson<TimelineEntry[]>(timelineKey, seedTimeline).sort(
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
