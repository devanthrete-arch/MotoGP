import { type GarageVehicle, type KnowledgeLabel, type OwnerPost, type ShortlistItem } from "./entities";

/**
 * Read-model shapes that cross the feature/infrastructure boundary.
 *
 * Each of these is *built* by a feature (`content` builds city circles and
 * playbooks, `garage` builds reminders, `buying` builds inspection checklists)
 * and *persisted* by `infrastructure/hosted`. Infrastructure may not import a
 * feature, so the shared shape is defined here and both sides import it. The
 * builders stay with the feature that owns the rules.
 */
export type GarageReminder = {
  id: string;
  vehicleId: string;
  vehicleName: string;
  title: string;
  detail: string;
  urgency: "Soon" | "Plan" | "Watch";
};

export type InspectionChecklistItem = {
  id: string;
  title: string;
  detail: string;
  priority: "High" | "Medium" | "Low";
};

export type InspectionChecklist = {
  item: ShortlistItem;
  checklist: InspectionChecklistItem[];
};

export type CityCircle = {
  city: string;
  posts: OwnerPost[];
  garageVehicles: GarageVehicle[];
  topBrands: string[];
  hotTopics: KnowledgeLabel[];
  localSignal: "Quiet" | "Active" | "Hot";
};

export type OwnershipPlaybook = {
  key: string;
  brand: string;
  model: string;
  headline: string;
  confidence: "Early signal" | "Useful base" | "Strong pattern";
  ownerSignals: string[];
  buyerChecks: string[];
  evidenceCount: number;
};
