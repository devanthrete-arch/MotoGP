/**
 * The account feature's remote surface: the profile row, notification
 * preferences and the queued notification jobs.
 */

export {
  channelForSettings,
  listHostedNotificationJobs,
  queueHostedNotifications,
  saveHostedProfile,
  saveHostedSubscriptionSettings,
} from "../../../infrastructure/hosted";

export type {
  HostedNotificationJob,
} from "../../../infrastructure/hosted";
