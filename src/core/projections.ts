import { type GarageVehicle, type KnowledgeLabel, type OwnerPost, type ShortlistItem } from "./entities";

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
