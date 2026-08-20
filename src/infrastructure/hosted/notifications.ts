import type { SubscriptionSettings } from "../../core/entities";
import type { Json } from "../supabase/database.types";
import { asBoolean, asCount, asIsoTimestamp, asNullableIsoTimestamp, asOneOf, asText } from "./kernel/coerce";
import { type HostedClient, type HostedResult, runHostedForUser, unwrap, unwrapWrite } from "./kernel/result";
import type { Insert, NotificationDeliveryRow, NotificationJobRow, SubscriptionSettingsRow } from "../supabase/tables";

export const notificationKinds = [
  "Digest",
  "Model alert",
  "Topic alert",
  "City alert",
  "Reminder",
  "Moderation",
] as const;
export const notificationChannels = ["Email digest", "Browser alert", "In-app"] as const;
export const notificationJobStatuses = ["Queued", "Sent", "Failed", "Cancelled", "Skipped"] as const;
export const notificationDeliveryStatuses = ["Sent", "Failed", "Opened", "Dismissed"] as const;

export type HostedNotificationKind = (typeof notificationKinds)[number];
export type HostedNotificationChannel = (typeof notificationChannels)[number];
export type HostedNotificationJobStatus = (typeof notificationJobStatuses)[number];
export type HostedNotificationDeliveryStatus = (typeof notificationDeliveryStatuses)[number];

export const defaultSubscriptionSettings: SubscriptionSettings = {
  browserAlerts: false,
  emailDigest: true,
  quietHours: true,
};

export type HostedNotificationJob = {
  id: string;
  kind: HostedNotificationKind;
  channel: HostedNotificationChannel;
  payload: Record<string, unknown>;
  scheduledFor: string;
  status: HostedNotificationJobStatus;
  deliveredAt: string | null;
  attempts: number;
  lastError: string;
};

export type HostedNotificationDelivery = {
  id: string;
  jobId: string;
  channel: HostedNotificationChannel;
  status: HostedNotificationDeliveryStatus;
  detail: string;
  deliveredAt: string;
};

export type HostedNotificationDraft = {
  kind: HostedNotificationKind;
  channel?: HostedNotificationChannel;
  payload?: Record<string, unknown>;
  scheduledFor?: string;
};

/* -------------------------------------------------------------------------- */
/* Pure mappers                                                               */
/* -------------------------------------------------------------------------- */

export const subscriptionRowToLocal = (
  row: Pick<SubscriptionSettingsRow, "browser_alerts" | "email_digest" | "quiet_hours"> | null,
): SubscriptionSettings =>
  row
    ? {
        browserAlerts: asBoolean(row.browser_alerts, false),
        emailDigest: asBoolean(row.email_digest, true),
        quietHours: asBoolean(row.quiet_hours, true),
      }
    : { ...defaultSubscriptionSettings };

export const subscriptionToRow = (
  userId: string,
  settings: SubscriptionSettings,
): Insert<"subscription_settings"> => ({
  browser_alerts: asBoolean(settings.browserAlerts, false),
  email_digest: asBoolean(settings.emailDigest, true),
  quiet_hours: asBoolean(settings.quietHours, true),
  user_id: userId,
});

const asPayloadRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const notificationJobRowToLocal = (row: NotificationJobRow): HostedNotificationJob => ({
  attempts: asCount(row.attempts),
  channel: asOneOf<HostedNotificationChannel>(row.channel, notificationChannels, "In-app"),
  deliveredAt: asNullableIsoTimestamp(row.delivered_at),
  id: asText(row.id),
  kind: asOneOf<HostedNotificationKind>(row.kind, notificationKinds, "Digest"),
  lastError: asText(row.last_error),
  payload: asPayloadRecord(row.payload),
  scheduledFor: asIsoTimestamp(row.scheduled_for),
  status: asOneOf<HostedNotificationJobStatus>(row.status, notificationJobStatuses, "Queued"),
});

export const notificationDraftToRow = (
  userId: string,
  draft: HostedNotificationDraft,
): Insert<"notification_jobs"> => ({
  channel: asOneOf<HostedNotificationChannel>(draft.channel, notificationChannels, "In-app"),
  kind: asOneOf<HostedNotificationKind>(draft.kind, notificationKinds, "Digest"),
  payload: asPayloadRecord(draft.payload) as unknown as Json,
  scheduled_for: asIsoTimestamp(draft.scheduledFor),
  user_id: userId,
});

export const notificationDeliveryRowToLocal = (row: NotificationDeliveryRow): HostedNotificationDelivery => ({
  channel: asOneOf<HostedNotificationChannel>(row.channel, notificationChannels, "In-app"),
  deliveredAt: asIsoTimestamp(row.delivered_at),
  detail: asText(row.detail),
  id: asText(row.id),
  jobId: asText(row.job_id),
  status: asOneOf<HostedNotificationDeliveryStatus>(row.status, notificationDeliveryStatuses, "Sent"),
});

/** Which channel a queued job should use, given the user's local preferences. */
export const channelForSettings = (settings: SubscriptionSettings): HostedNotificationChannel => {
  if (asBoolean(settings.emailDigest, true)) return "Email digest";
  if (asBoolean(settings.browserAlerts, false)) return "Browser alert";
  return "In-app";
};

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

export const selectSubscriptionRow = async (
  client: HostedClient,
  userId: string,
): Promise<SubscriptionSettingsRow | null> =>
  unwrap(await client.from("subscription_settings").select("*").eq("user_id", userId).maybeSingle(), null);

export const selectNotificationJobRows = async (
  client: HostedClient,
  userId: string,
): Promise<NotificationJobRow[]> =>
  unwrap(
    await client
      .from("notification_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("scheduled_for", { ascending: false }),
    [],
  );

export const loadHostedSubscriptionSettings = (
  userId: string | null | undefined,
  fallback: SubscriptionSettings = defaultSubscriptionSettings,
): Promise<HostedResult<SubscriptionSettings>> =>
  runHostedForUser<SubscriptionSettings>(userId, fallback, async (client, id) => {
    const row = await selectSubscriptionRow(client, id);
    return row ? subscriptionRowToLocal(row) : fallback;
  });

export const saveHostedSubscriptionSettings = (
  userId: string | null | undefined,
  settings: SubscriptionSettings,
) =>
  runHostedForUser<SubscriptionSettings>(userId, settings, async (client, id) => {
    unwrapWrite(
      await client.from("subscription_settings").upsert(subscriptionToRow(id, settings), { onConflict: "user_id" }),
    );
    return settings;
  });

export const listHostedNotificationJobs = (
  userId: string | null | undefined,
  fallback: HostedNotificationJob[] = [],
) =>
  runHostedForUser<HostedNotificationJob[]>(userId, fallback, async (client, id) =>
    (await selectNotificationJobRows(client, id)).map(notificationJobRowToLocal),
  );

export const queueHostedNotification = (userId: string | null | undefined, draft: HostedNotificationDraft) =>
  runHostedForUser<HostedNotificationDraft>(userId, draft, async (client, id) => {
    unwrapWrite(await client.from("notification_jobs").insert(notificationDraftToRow(id, draft)));
    return draft;
  });

export const queueHostedNotifications = (userId: string | null | undefined, drafts: HostedNotificationDraft[]) =>
  runHostedForUser<HostedNotificationDraft[]>(userId, drafts, async (client, id) => {
    if (!drafts.length) return drafts;
    unwrapWrite(
      await client.from("notification_jobs").insert(drafts.map((draft) => notificationDraftToRow(id, draft))),
    );
    return drafts;
  });

export const setHostedNotificationJobStatus = (
  userId: string | null | undefined,
  jobId: string,
  status: HostedNotificationJobStatus,
) =>
  runHostedForUser<HostedNotificationJobStatus>(userId, status, async (client, id) => {
    const safeStatus = asOneOf<HostedNotificationJobStatus>(status, notificationJobStatuses, "Queued");
    unwrapWrite(
      await client
        .from("notification_jobs")
        .update({
          delivered_at: safeStatus === "Sent" ? new Date().toISOString() : null,
          status: safeStatus,
        })
        .eq("id", jobId)
        .eq("user_id", id),
    );
    return safeStatus;
  });

export const listHostedNotificationDeliveries = (
  userId: string | null | undefined,
  fallback: HostedNotificationDelivery[] = [],
) =>
  runHostedForUser<HostedNotificationDelivery[]>(userId, fallback, async (client, id) => {
    const rows = unwrap(
      await client
        .from("notification_deliveries")
        .select("*")
        .eq("user_id", id)
        .order("delivered_at", { ascending: false }),
      [],
    );
    return rows.map(notificationDeliveryRowToLocal);
  });

export const recordHostedDelivery = (
  userId: string | null | undefined,
  jobId: string,
  channel: HostedNotificationChannel,
  status: HostedNotificationDeliveryStatus = "Sent",
  detail = "",
) =>
  runHostedForUser<HostedNotificationDeliveryStatus>(userId, status, async (client, id) => {
    unwrapWrite(
      await client.from("notification_deliveries").insert({
        channel: asOneOf<HostedNotificationChannel>(channel, notificationChannels, "In-app"),
        detail: asText(detail).slice(0, 2000),
        job_id: jobId,
        status: asOneOf<HostedNotificationDeliveryStatus>(status, notificationDeliveryStatuses, "Sent"),
        user_id: id,
      }),
    );
    return status;
  });
