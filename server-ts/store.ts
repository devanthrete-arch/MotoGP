import type {
  FollowState,
  GarageVehicle,
  OwnerPost,
  Profile,
  ReportRecord,
  ShortlistItem,
  TimelineEntry,
} from "../src/domain";
import { seedGarage, seedPosts, seedTimeline } from "../src/domain";

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
