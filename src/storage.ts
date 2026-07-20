import type { DraftPost, FeedbackNote, OwnerPost } from "./domain";
import { seedPosts } from "./domain";

const postsKey = "autoflex.web.posts.v1";
const savedKey = "autoflex.web.saved.v1";
const feedbackKey = "autoflex.web.feedback.v1";

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
