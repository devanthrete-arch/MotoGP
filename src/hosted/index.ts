/**
 * AutoFlex hosted data-access layer.
 *
 * Everything here is local-first: each call returns a discriminated
 * {@link HostedResult} that carries usable `data` on both the success and the
 * failure arm, and degrades to the local value when hosted sync is
 * unconfigured, the user is signed out, the browser is offline, or the request
 * fails. Nothing in this directory throws into a render.
 *
 * Mappers are pure and exported separately from the IO functions so they can be
 * unit tested without a live Supabase client.
 */

/* Client cache -------------------------------------------------------------- */
export {
  CACHE_TTL,
  clearHostedCache,
  createHostedCache,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_STALE_MS,
  DEFAULT_TTL_MS,
  HostedCache,
  hostedCache,
  invalidateHostedNamespace,
  invalidateHostedUser,
  ownerKey,
  publicKey,
  readThroughCache,
} from "./cache";
export type { CacheKey, CachePart, HostedCacheOptions, HostedCacheStats, ReadOptions } from "./cache";

export {
  dataOf,
  describeError,
  hostedFallback,
  hostedOk,
  isBrowserOffline,
  runHosted,
  runHostedForUser,
  unwrap,
  unwrapWrite,
} from "./result";
export type { HostedClient, HostedFailure, HostedFailureReason, HostedResult, HostedSuccess } from "./result";

export {
  asAmount,
  asBoolean,
  asCount,
  asDateOnly,
  asFiniteNumber,
  asIsoTimestamp,
  asNullableDateOnly,
  asNullableIsoTimestamp,
  asOneOf,
  asStringList,
  asText,
  asTrimmedText,
  byIdMap,
  nowIso,
  slugify,
  timestampOf,
} from "./coerce";

export type {
  CityCircleRow,
  CityFollowRow,
  FeedbackEntryRow,
  FollowRow,
  GarageCostRow,
  GarageReminderRow,
  GarageVehicleRow,
  Insert,
  InspectionItemRow,
  InspectionSessionRow,
  ModelPlaybookRow,
  NotificationDeliveryRow,
  NotificationJobRow,
  OwnerPostRow,
  PlaybookEntryRow,
  PostCommentRow,
  PostQualityScoreRow,
  ProfileRow,
  ReportRow,
  Row,
  SavedPostRow,
  ShortlistItemRow,
  SubscriptionSettingsRow,
  TableName,
  TimelineEntryRow,
} from "./tables";

/* Profile ------------------------------------------------------------------ */
export {
  emptyProfile,
  garageRoleValues,
  loadHostedProfile,
  profileRowToLocal,
  profileToRow,
  saveHostedProfile,
  selectProfileRow,
} from "./profile";

/* Community ---------------------------------------------------------------- */
export {
  addHostedComment,
  commentRowToLine,
  deleteHostedPost,
  groupCommentLines,
  listHostedPostRankings,
  listHostedPosts,
  listHostedReports,
  listHostedSavedPostIds,
  mergePostCollections,
  postRowToLocal,
  postRowToRanking,
  postToRow,
  qualityGradeValues,
  replaceHostedSavedPosts,
  reportRowToLocal,
  reportStatusValues,
  reportToRow,
  selectCommentRowsForPost,
  listHostedCommentsForPost,
  listHostedPostsPage,
  encodeFeedCursor,
  decodeFeedCursor,
  FEED_PAGE_SIZE,
  FEED_MAX_ROWS,
  selectOwnerPostRows,
  selectReportRows,
  selectSavedPostIds,
  setHostedReportStatus,
  setHostedSavedPost,
  sortPostsByRecency,
  upsertHostedPost,
  upsertHostedPosts,
  upsertHostedReport,
  upsertHostedReports,
} from "./community";
export type { HostedPostRanking } from "./community";

/* Follows ------------------------------------------------------------------ */
export {
  cityFollowRowToLocal,
  cityFollowToRow,
  emptyFollowState,
  followRowToLocal,
  followStateToRow,
  listHostedCityFollows,
  loadHostedFollows,
  mergeFollowStates,
  saveHostedFollows,
  selectCityFollowRows,
  selectFollowRow,
  setHostedCityFollow,
} from "./follows";
export type { HostedCityFollow } from "./follows";

/* Garage ------------------------------------------------------------------- */
export {
  costCategoryForTimelineKind,
  costCategoryValues,
  costRowToLocal,
  costToRow,
  costsFromTimeline,
  deleteHostedCost,
  deleteHostedReminder,
  deleteHostedTimelineEntry,
  deleteHostedVehicle,
  listHostedCosts,
  listHostedGarage,
  listHostedReminders,
  listHostedTimeline,
  reminderKindForLocalId,
  reminderKindValues,
  reminderRowToLocal,
  reminderStatusValues,
  reminderToRow,
  reminderUrgencyValues,
  selectCostRows,
  selectReminderRows,
  selectTimelineRows,
  selectVehicleRows,
  setHostedReminderStatus,
  syncHostedCostsFromTimeline,
  timelineEntryToCost,
  timelineEntryToRow,
  timelineRowToLocal,
  upsertHostedCosts,
  upsertHostedReminders,
  upsertHostedTimelineEntries,
  upsertHostedTimelineEntry,
  upsertHostedVehicle,
  upsertHostedVehicles,
  vehicleDisplayName,
  vehicleNameIndex,
  vehicleRowToLocal,
  vehicleToRow,
} from "./garage";
export type {
  HostedCostCategory,
  HostedGarageCost,
  HostedGarageReminder,
  HostedReminderKind,
  HostedReminderStatus,
} from "./garage";

/* Shortlist ---------------------------------------------------------------- */
export {
  deleteHostedShortlistItem,
  listHostedShortlist,
  selectShortlistRows,
  shortlistItemToRow,
  shortlistRowToLocal,
  upsertHostedShortlistItem,
  upsertHostedShortlistItems,
} from "./shortlist";

/* Inspections -------------------------------------------------------------- */
export {
  checklistToSession,
  deleteHostedInspection,
  groupInspectionItemRows,
  inspectionItemRowToLocal,
  inspectionItemStateValues,
  inspectionItemToRow,
  inspectionPriorityValues,
  inspectionSessionIdFor,
  inspectionSessionRowToLocal,
  inspectionStatusValues,
  inspectionVerdictValues,
  listHostedInspections,
  publishHostedChecklists,
  selectInspectionItemRows,
  selectInspectionSessionRows,
  sessionToChecklist,
  sessionToRow,
  setHostedInspectionItemState,
  upsertHostedInspection,
  upsertHostedInspections,
} from "./inspections";
export type {
  HostedInspectionItem,
  HostedInspectionItemState,
  HostedInspectionSession,
  HostedInspectionStatus,
  HostedInspectionVerdict,
} from "./inspections";

/* Cities ------------------------------------------------------------------- */
export {
  cityCircleToHosted,
  cityRowToHosted,
  hostedCityToLocal,
  hostedCityToRow,
  listHostedCityCircles,
  loadHostedCityCircle,
  localSignalValues,
  publishHostedCityCircles,
  selectCityCircleRows,
  upsertHostedCityCircles,
} from "./cities";
export type { HostedCityCircle, HostedCitySignal } from "./cities";

/* Playbooks ---------------------------------------------------------------- */
export {
  addHostedPlaybookEntry,
  listHostedPlaybookEntries,
  listHostedPlaybooks,
  loadHostedPlaybook,
  playbookConfidenceValues,
  playbookEntryKinds,
  playbookEntryRowToLocal,
  playbookEntryToRow,
  playbookRowToLocal,
  playbookToEntries,
  playbookToRow,
  selectPlaybookEntryRows,
  selectPlaybookRows,
  upsertHostedPlaybooks,
} from "./playbooks";
export type { HostedPlaybookConfidence, HostedPlaybookEntry, HostedPlaybookEntryKind } from "./playbooks";

/* Notifications ------------------------------------------------------------ */
export {
  channelForSettings,
  defaultSubscriptionSettings,
  listHostedNotificationDeliveries,
  listHostedNotificationJobs,
  loadHostedSubscriptionSettings,
  notificationChannels,
  notificationDeliveryRowToLocal,
  notificationDeliveryStatuses,
  notificationDraftToRow,
  notificationJobRowToLocal,
  notificationJobStatuses,
  notificationKinds,
  queueHostedNotification,
  queueHostedNotifications,
  recordHostedDelivery,
  saveHostedSubscriptionSettings,
  selectNotificationJobRows,
  selectSubscriptionRow,
  setHostedNotificationJobStatus,
  subscriptionRowToLocal,
  subscriptionToRow,
} from "./notifications";
export type {
  HostedNotificationChannel,
  HostedNotificationDelivery,
  HostedNotificationDeliveryStatus,
  HostedNotificationDraft,
  HostedNotificationJob,
  HostedNotificationJobStatus,
  HostedNotificationKind,
} from "./notifications";

/* Feedback ----------------------------------------------------------------- */
export {
  deleteHostedFeedbackNote,
  feedbackRowToLocal,
  feedbackToRow,
  listHostedFeedback,
  selectFeedbackRows,
  setHostedFeedbackLoopStage,
  setHostedFeedbackStatus,
  sortFeedbackByRecency,
  upsertHostedFeedback,
  upsertHostedFeedbackNote,
} from "./feedback";

/* Quality and ranking ------------------------------------------------------ */
export {
  emptyQualityReport,
  listHostedPostQuality,
  postToQuality,
  publishHostedPostQuality,
  qualityGrades,
  qualityIndex,
  qualityRowToLocal,
  qualityRowToReport,
  qualityToRow,
  rankPosts,
  rankingScoreFor,
  selectQualityRows,
  upsertHostedPostQuality,
} from "./quality";
export type { HostedPostQuality, HostedQualityGrade } from "./quality";

/* Whole-workspace sync ----------------------------------------------------- */
export { hostedSyncDomains, mergeKeyedCollection, mergeSingleton, mergeStringSets, syncAllHosted } from "./syncAll";
export type {
  HostedDomainReport,
  HostedSyncDomain,
  HostedSyncOutcome,
  HostedWorkspaceSnapshot,
  MergeOutcome,
  SyncAllHostedOptions,
} from "./syncAll";
