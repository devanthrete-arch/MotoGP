import type {
  FollowState,
  GarageVehicle,
  OwnerPost,
  Profile,
  ReportRecord,
  ShortlistItem,
  TimelineEntry,
} from "../src/core/entities";
import { seedGarage, seedPosts, seedTimeline } from "../src/core/entities";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type FeedbackRecord = {
  id: string;
  author: string;
  message: string;
  surface: string;
  createdAt: string;
};

export type InspectionSession = {
  id: string;
  shortlistItemId: string;
  notes: string[];
  completedChecks: string[];
  createdAt: string;
};

export type AutoflexStore = {
  comments: Map<string, string[]>;
  feedback: Map<string, FeedbackRecord>;
  follows: Map<string, FollowState>;
  garage: Map<string, GarageVehicle>;
  inspections: Map<string, InspectionSession>;
  posts: Map<string, OwnerPost>;
  profiles: Map<string, Profile>;
  reports: Map<string, ReportRecord>;
  saves: Map<string, Set<string>>;
  shortlist: Map<string, ShortlistItem>;
  timeline: Map<string, TimelineEntry>;
};

type PersistedAutoflexStore = {
  comments: [string, string[]][];
  feedback: FeedbackRecord[];
  follows: [string, FollowState][];
  garage: GarageVehicle[];
  inspections: InspectionSession[];
  posts: OwnerPost[];
  profiles: [string, Profile][];
  reports: ReportRecord[];
  saves: [string, string[]][];
  shortlist: ShortlistItem[];
  timeline: TimelineEntry[];
};

export type StorePersistence = {
  path?: string;
  persist: () => Promise<void>;
  storage: "file" | "memory";
};

export type StoreBundle = {
  persistence: StorePersistence;
  store: AutoflexStore;
};

const cloneMap = <T extends { id: string }>(items: T[]): Map<string, T> => new Map(items.map((item) => [item.id, item]));

export const createMemoryStore = (): AutoflexStore => ({
  comments: new Map(seedPosts.map((post) => [post.id, [...post.comments]])),
  feedback: new Map(),
  follows: new Map([["demo", { models: ["tata-nexon"], topics: ["Fix", "Cost note"] }]]),
  garage: cloneMap(seedGarage),
  inspections: new Map(),
  posts: cloneMap(seedPosts),
  profiles: new Map([
    [
      "demo",
      {
        city: "Pune",
        displayName: "Demo owner",
        garageRole: "Owner",
      },
    ],
  ]),
  reports: new Map(),
  saves: new Map([["demo", new Set(["nexon-diesel-clutch"])]]),
  shortlist: new Map(),
  timeline: cloneMap(seedTimeline),
});

const snapshotStore = (store: AutoflexStore): PersistedAutoflexStore => ({
  comments: [...store.comments.entries()],
  feedback: [...store.feedback.values()],
  follows: [...store.follows.entries()],
  garage: [...store.garage.values()],
  inspections: [...store.inspections.values()],
  posts: [...store.posts.values()],
  profiles: [...store.profiles.entries()],
  reports: [...store.reports.values()],
  saves: [...store.saves.entries()].map(([profileId, postIds]) => [profileId, [...postIds]]),
  shortlist: [...store.shortlist.values()],
  timeline: [...store.timeline.values()],
});

const restoreStore = (snapshot: Partial<PersistedAutoflexStore>): AutoflexStore => {
  const fallback = createMemoryStore();
  return {
    comments: new Map(snapshot.comments ?? fallback.comments),
    feedback: cloneMap(snapshot.feedback ?? []),
    follows: new Map(snapshot.follows ?? fallback.follows),
    garage: cloneMap(snapshot.garage ?? [...fallback.garage.values()]),
    inspections: cloneMap(snapshot.inspections ?? []),
    posts: cloneMap(snapshot.posts ?? [...fallback.posts.values()]),
    profiles: new Map(snapshot.profiles ?? fallback.profiles),
    reports: cloneMap(snapshot.reports ?? []),
    saves: new Map((snapshot.saves ?? [...fallback.saves.entries()].map(([profileId, postIds]) => [profileId, [...postIds]]))
      .map(([profileId, postIds]) => [profileId, new Set(postIds)])),
    shortlist: cloneMap(snapshot.shortlist ?? []),
    timeline: cloneMap(snapshot.timeline ?? [...fallback.timeline.values()]),
  };
};

export const createStoreBundle = async (dataPath?: string): Promise<StoreBundle> => {
  if (!dataPath) {
    return {
      persistence: {
        persist: async () => undefined,
        storage: "memory",
      },
      store: createMemoryStore(),
    };
  }

  let store = createMemoryStore();
  try {
    const raw = await readFile(dataPath, "utf8");
    store = restoreStore(JSON.parse(raw) as Partial<PersistedAutoflexStore>);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }

  return {
    persistence: {
      path: dataPath,
      persist: async () => {
        await mkdir(dirname(dataPath), { recursive: true });
        const tempPath = `${dataPath}.tmp`;
        await writeFile(tempPath, `${JSON.stringify(snapshotStore(store), null, 2)}\n`, "utf8");
        await rename(tempPath, dataPath);
      },
      storage: "file",
    },
    store,
  };
};

export const makeId = (prefix: string, input = ""): string => {
  const safeInput = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return [prefix, safeInput, suffix].filter(Boolean).join("-");
};
