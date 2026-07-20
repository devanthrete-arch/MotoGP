import type {
  DraftPost,
  DraftReport,
  DraftTimelineEntry,
  DraftVehicle,
  FeedbackNote,
  FollowState,
  GarageVehicle,
  OwnerPost,
  Profile,
  ReportRecord,
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

const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const loadPosts = (): OwnerPost[] => {
  const posts = safeJsonParse<OwnerPost[]>(localStorage.getItem(postsKey), seedPosts);
  return posts.sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
};

export const savePosts = (posts: OwnerPost[]): void => {
  localStorage.setItem(postsKey, JSON.stringify(posts));
};

export const createPost = (draft: DraftPost): OwnerPost => ({
  ...draft,
  id: `${draft.brand}-${draft.model}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  createdAt: new Date().toISOString(),
  helpful: 0,
  fixesConfirmed: 0,
  comments: [],
});

export const loadSaved = (): Set<string> => new Set(safeJsonParse<string[]>(localStorage.getItem(savedKey), []));

export const saveSaved = (saved: Set<string>): void => {
  localStorage.setItem(savedKey, JSON.stringify([...saved]));
};

export const loadFeedback = (): FeedbackNote[] => safeJsonParse<FeedbackNote[]>(localStorage.getItem(feedbackKey), []);

export const addFeedback = (message: string): FeedbackNote[] => {
  const next = [
    {
      id: `feedback-${Date.now()}`,
      message,
      createdAt: new Date().toISOString(),
    },
    ...loadFeedback(),
  ];
  localStorage.setItem(feedbackKey, JSON.stringify(next));
  return next;
};

export const loadFollows = (): FollowState =>
  safeJsonParse<FollowState>(localStorage.getItem(followKey), { models: [], topics: [] });

export const saveFollows = (follows: FollowState): void => {
  localStorage.setItem(followKey, JSON.stringify(follows));
};

export const loadGarage = (): GarageVehicle[] => safeJsonParse<GarageVehicle[]>(localStorage.getItem(garageKey), seedGarage);

export const saveGarage = (garage: GarageVehicle[]): void => {
  localStorage.setItem(garageKey, JSON.stringify(garage));
};

export const createVehicle = (draft: DraftVehicle): GarageVehicle => ({
  ...draft,
  id: `${draft.brand}-${draft.model}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
});

export const loadTimeline = (): TimelineEntry[] =>
  safeJsonParse<TimelineEntry[]>(localStorage.getItem(timelineKey), seedTimeline).sort(
    (first, second) => Date.parse(second.happenedOn) - Date.parse(first.happenedOn),
  );

export const saveTimeline = (entries: TimelineEntry[]): void => {
  localStorage.setItem(timelineKey, JSON.stringify(entries));
};

export const createTimelineEntry = (draft: DraftTimelineEntry): TimelineEntry => ({
  ...draft,
  id: `${draft.vehicleId}-${draft.kind}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
});

export const loadSubscriptionSettings = (): SubscriptionSettings =>
  safeJsonParse<SubscriptionSettings>(localStorage.getItem(subscriptionKey), {
    emailDigest: true,
    browserAlerts: false,
    quietHours: true,
  });

export const saveSubscriptionSettings = (settings: SubscriptionSettings): void => {
  localStorage.setItem(subscriptionKey, JSON.stringify(settings));
};

export const loadProfile = (): Profile =>
  safeJsonParse<Profile>(localStorage.getItem(profileKey), {
    city: "",
    displayName: "",
    garageRole: "Owner",
  });

export const saveProfile = (profile: Profile): void => {
  localStorage.setItem(profileKey, JSON.stringify(profile));
};

export const loadReports = (): ReportRecord[] => safeJsonParse<ReportRecord[]>(localStorage.getItem(reportsKey), []);

export const saveReports = (reports: ReportRecord[]): void => {
  localStorage.setItem(reportsKey, JSON.stringify(reports));
};

export const createReport = (draft: DraftReport): ReportRecord => ({
  ...draft,
  id: `report-${draft.postId}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  status: "Open",
  createdAt: new Date().toISOString(),
});
