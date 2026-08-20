/**
 * The community feature's remote surface.
 *
 * Screens and hooks inside this feature import hosted data from here, never
 * from `infrastructure/hosted` directly. That keeps the list of tables this
 * feature is allowed to touch reviewable in one file, and it is the seam to
 * change if community ever moves off Supabase.
 *
 * Every call returns a non-throwing `HostedResult` with usable `data` on both
 * arms, so nothing here can block a render or reach an error boundary.
 */

export {
  addHostedComment,
  deleteHostedPost,
  listHostedPostQuality,
  listHostedPosts,
  mergePostCollections,
  publishHostedPostQuality,
  saveHostedFollows,
  setHostedReportStatus,
  setHostedSavedPost,
  upsertHostedPost,
  upsertHostedPosts,
  upsertHostedReport,
  upsertHostedReports,
} from "../../../infrastructure/hosted";

export type {
  HostedPostQuality,
} from "../../../infrastructure/hosted";
