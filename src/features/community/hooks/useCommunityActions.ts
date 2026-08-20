import { useCallback, type Dispatch, type FormEvent, type RefObject, type SetStateAction } from "react";
import {
  modelKeyFor,
  type DraftPost,
  type FollowState,
  type KnowledgeLabel,
  type ModelNotebook,
  type OwnerPost,
  type OwnershipPlaybook,
  type Profile,
  type ReportRecord,
} from "../../../core";
import { createPost, createReport, saveSaved } from "../../../infrastructure/storage/localStore";
import {
  addHostedComment,
  publishHostedPostQuality,
  setHostedSavedPost,
  upsertHostedPost,
  upsertHostedReport,
} from "../data/communityRepository";
import { type CloudUser } from "../../../infrastructure/supabase/auth";
import { initialPostDraft } from "../domain/drafts";

/**
 * Ports the composition root fills in. The feature says *what* it wants shared;
 * the app owns *how* (Web Share, clipboard, then manual copy) and the routes
 * the share link points at. Declaring the ports here is what keeps the feature
 * from importing the app layer.
 */
export type SharePostPort = (post: OwnerPost) => void;
export type SharePlaybookPort = (playbook: {
  brand: string;
  confidence: OwnershipPlaybook["confidence"];
  evidenceCount: number;
  headline: string;
  model: string;
}) => void;

/**
 * Everything that writes to a community record: saving, following, helpful and
 * fix confirmations, comments, reports, moderation outcomes, publishing and
 * sharing. Each handler is the original body — the only change is that the
 * state it touches now arrives as an argument.
 */
export function useCommunityActions({
  cloudUser,
  commentDraft,
  draft,
  follows,
  noteLocalWrite,
  notebooks,
  ownershipPlaybooks,
  persistFollows,
  persistPosts,
  persistReports,
  postDetailHeadingRef,
  posts,
  profile,
  reportDraft,
  reports,
  saved,
  selectedPost,
  setActionMessage,
  setCommentDraft,
  setDraft,
  setPostComposerOpen,
  setPostDetailOpen,
  setReportDraft,
  setSaved,
  setSelectedPost,
  sharePlaybook,
  sharePost,
}: {
  cloudUser: CloudUser | null;
  commentDraft: string;
  draft: DraftPost;
  follows: FollowState;
  noteLocalWrite: (push?: (userId: string) => void) => void;
  notebooks: ModelNotebook[];
  ownershipPlaybooks: OwnershipPlaybook[];
  persistFollows: (next: FollowState) => void;
  persistPosts: (next: OwnerPost[]) => void;
  persistReports: (next: ReportRecord[]) => void;
  postDetailHeadingRef: RefObject<HTMLHeadingElement | null>;
  posts: OwnerPost[];
  profile: Profile;
  reportDraft: string;
  reports: ReportRecord[];
  saved: Set<string>;
  selectedPost: OwnerPost | null;
  setActionMessage: Dispatch<SetStateAction<string>>;
  setCommentDraft: Dispatch<SetStateAction<string>>;
  setDraft: Dispatch<SetStateAction<DraftPost>>;
  setPostComposerOpen: Dispatch<SetStateAction<boolean>>;
  setPostDetailOpen: Dispatch<SetStateAction<boolean>>;
  setReportDraft: Dispatch<SetStateAction<string>>;
  setSaved: Dispatch<SetStateAction<Set<string>>>;
  setSelectedPost: Dispatch<SetStateAction<OwnerPost | null>>;
  sharePlaybook: SharePlaybookPort;
  sharePost: SharePostPort;
}) {
  /**
   * Wrapped in `useCallback` so memoised list rows can skip re-rendering.
   * The dependency is the data it actually reads, not the whole render — a
   * keystroke in the composer no longer changes this function's identity.
   */
  const toggleSaved = useCallback((postId: string) => {
    const next = new Set(saved);
    const wasSaved = next.has(postId);
    if (wasSaved) next.delete(postId);
    else next.add(postId);
    setSaved(next);
    saveSaved(next);
    setActionMessage(wasSaved ? "Removed from saved notes." : "Note saved.");
    noteLocalWrite((userId) => void setHostedSavedPost(userId, postId, !wasSaved));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- persist helpers are recreated each render by design
  }, [saved]);

  const toggleFollowModel = (brand: string, model: string) => {
    const key = modelKeyFor(brand, model);
    const nextModels = follows.models.includes(key) ? follows.models.filter((item) => item !== key) : [...follows.models, key];
    persistFollows({ ...follows, models: nextModels });
  };

  const toggleFollowTopic = (topic: KnowledgeLabel) => {
    const nextTopics = follows.topics.includes(topic)
      ? follows.topics.filter((item) => item !== topic)
      : [...follows.topics, topic];
    persistFollows({ ...follows, topics: nextTopics });
  };

  const markHelpful = useCallback((postId: string) => {
    const next = posts.map((post) => (post.id === postId ? { ...post, helpful: post.helpful + 1 } : post));
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- persist helpers are recreated each render by design
  }, [posts]);

  const confirmFix = (postId: string) => {
    const next = posts.map((post) =>
      post.id === postId ? { ...post, fixesConfirmed: post.fixesConfirmed + 1, helpful: post.helpful + 1 } : post,
    );
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  };

  const addComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPost || !commentDraft.trim()) return;
    const author = profile.displayName.trim() || "Anonymous garage member";
    const next = posts.map((post) =>
      post.id === selectedPost.id ? { ...post, comments: [`${author}: ${commentDraft.trim()}`, ...post.comments] } : post,
    );
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === selectedPost.id) ?? null);
    setCommentDraft("");
    const comment = commentDraft.trim();
    const postId = selectedPost.id;
    noteLocalWrite((userId) => void addHostedComment(userId, postId, author, comment));
    setActionMessage(cloudUser ? "Comment posted." : "Comment saved on this device. Sign in to share it with Community.");
  };

  const reportSelectedPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPost || !reportDraft.trim()) return;
    const report = createReport({
      postId: selectedPost.id,
      postTitle: selectedPost.title,
      reason: reportDraft.trim(),
      reporterName: profile.displayName.trim() || "Anonymous reporter",
    });
    persistReports([report, ...reports]);
    setReportDraft("");
    noteLocalWrite((userId) => void upsertHostedReport(userId, report));
    setActionMessage(
      cloudUser ? "Report sent to moderators." : "Report saved on this device. Sign in to send it to moderators.",
    );
  };

  const setReportStatus = (reportId: string, status: ReportRecord["status"]) => {
    persistReports(reports.map((report) => (report.id === reportId ? { ...report, status } : report)));
  };

  const removeReportedPost = (report: ReportRecord) => {
    const nextPosts = posts.filter((post) => post.id !== report.postId);
    persistPosts(nextPosts);
    persistReports(reports.map((item) => (item.id === report.id ? { ...item, status: "Removed" } : item)));
    if (selectedPost?.id === report.postId) setSelectedPost(nextPosts[0] ?? null);
  };

  const shareSelectedPost = () => {
    if (!selectedPost) return;
    sharePost(selectedPost);
  };

  const shareModelNotebook = (brand: string, model: string) => {
    const key = modelKeyFor(brand, model);
    const notebook = notebooks.find((item) => item.key === key);
    if (!notebook) return;
    const playbook = ownershipPlaybooks.find((item) => item.key === key);
    sharePlaybook({
      brand,
      model,
      confidence: playbook?.confidence ?? "Early signal",
      evidenceCount: playbook?.evidenceCount ?? notebook.posts.length,
      headline: playbook?.headline ?? `${brand} ${model} owner notes`,
    });
  };

  const publishPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const post = createPost({
      ...draft,
      author: draft.author.trim() || "Anonymous owner",
      odometerKm: Number.isFinite(draft.odometerKm) ? draft.odometerKm : 0,
    });
    const next = [post, ...posts];
    persistPosts(next);
    noteLocalWrite((userId) => {
      void upsertHostedPost(userId, post);
      void publishHostedPostQuality(userId, [post]);
    });
    setSelectedPost(post);
    setPostDetailOpen(true);
    setPostComposerOpen(false);
    setDraft(initialPostDraft);
    setActionMessage(cloudUser ? "Owner note published." : "Note saved on this device. Sign in to publish it to Community.");
    window.requestAnimationFrame(() => postDetailHeadingRef.current?.focus());
  };

  return {
    addComment,
    confirmFix,
    markHelpful,
    publishPost,
    removeReportedPost,
    reportSelectedPost,
    setReportStatus,
    shareModelNotebook,
    shareSelectedPost,
    toggleFollowModel,
    toggleFollowTopic,
    toggleSaved,
  };
}
