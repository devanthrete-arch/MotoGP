import type { Database } from "../database.types";

type PublicTables = Database["public"]["Tables"];

export type TableName = keyof PublicTables;

export type Row<Name extends TableName> = PublicTables[Name]["Row"];

export type Insert<Name extends TableName> = PublicTables[Name]["Insert"];

export type ProfileRow = Row<"profiles">;
export type OwnerPostRow = Row<"owner_posts">;
export type PostCommentRow = Row<"post_comments">;
export type SavedPostRow = Row<"saved_posts">;
export type ReportRow = Row<"reports">;
export type FollowRow = Row<"follows">;
export type CityFollowRow = Row<"city_follows">;
export type CityCircleRow = Row<"city_circles">;
export type GarageVehicleRow = Row<"garage_vehicles">;
export type TimelineEntryRow = Row<"timeline_entries">;
export type GarageCostRow = Row<"garage_costs">;
export type GarageReminderRow = Row<"garage_reminders">;
export type ShortlistItemRow = Row<"shortlist_items">;
export type InspectionSessionRow = Row<"inspection_sessions">;
export type InspectionItemRow = Row<"inspection_items">;
export type ModelPlaybookRow = Row<"model_playbooks">;
export type PlaybookEntryRow = Row<"playbook_entries">;
export type NotificationJobRow = Row<"notification_jobs">;
export type NotificationDeliveryRow = Row<"notification_deliveries">;
export type SubscriptionSettingsRow = Row<"subscription_settings">;
export type FeedbackEntryRow = Row<"feedback_entries">;
export type PostQualityScoreRow = Row<"post_quality_scores">;
