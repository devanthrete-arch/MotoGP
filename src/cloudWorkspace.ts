import type { SupabaseClient } from "@supabase/supabase-js";
import type { FollowState, GarageVehicle, Profile, ShortlistItem, TimelineEntry } from "./domain";

export type PrivateWorkspace = {
  version: 1;
  profile: Profile;
  garage: GarageVehicle[];
  timeline: TimelineEntry[];
  shortlist: ShortlistItem[];
  follows: FollowState;
  saved: string[];
};
export type CloudWorkspace = { payload: PrivateWorkspace; revision: number; updatedAt: string };

const invalid = (): never => { throw new Error("Account data has an unsupported format. Nothing was replaced."); };
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : invalid();
const text = (value: unknown, max = 500): string => typeof value === "string" && value.length <= max ? value : invalid();
const number = (value: unknown): number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e12 ? value : invalid();
const list = <T,>(value: unknown, parse: (item: unknown) => T): T[] =>
  Array.isArray(value) && value.length <= 5000 ? value.map(parse) : invalid();
const choice = <T extends string>(value: unknown, choices: readonly T[]): T =>
  choices.includes(value as T) ? value as T : invalid();
const id = (value: unknown): string => text(value, 250).trim() ? text(value, 250) : invalid();
const date = (value: unknown): string => {
  const result = text(value, 10);
  return /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(result) && Number.isFinite(Date.parse(result)) && new Date(result).toISOString().slice(0, 10) === result ? result : invalid();
};
const unique = <T extends { id: string }>(rows: T[]): T[] => new Set(rows.map(row => row.id)).size === rows.length ? rows : invalid();

// Decode the entire snapshot before it can replace any local state.
export function parsePrivateWorkspace(value: unknown): PrivateWorkspace {
  const data = record(value);
  if (data.version !== 1 || Object.keys(data).sort().join() !== "follows,garage,profile,saved,shortlist,timeline,version") invalid();
  const profile = record(data.profile);
  const follows = record(data.follows);
  const garage = unique(list(data.garage, value => {
    const row = record(value);
    const purchaseMonth = text(row.purchaseMonth, 7);
    if (purchaseMonth && !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(purchaseMonth)) invalid();
    return { id: id(row.id), nickname: text(row.nickname), brand: text(row.brand), model: text(row.model),
      variant: text(row.variant), city: text(row.city), odometerKm: number(row.odometerKm), purchaseMonth };
  }));
  const vehicleIds = new Set(garage.map(row => row.id));
  const timeline = unique(list(data.timeline, value => {
    const row = record(value);
    if (!vehicleIds.has(id(row.vehicleId))) invalid();
    return { id: id(row.id), vehicleId: id(row.vehicleId), kind: choice(row.kind, ["Service", "Repair", "Tyres", "Insurance", "Fuel", "Trip", "Note"]),
      title: text(row.title), amount: number(row.amount), odometerKm: number(row.odometerKm), happenedOn: date(row.happenedOn), note: text(row.note, 10000) };
  }));
  const shortlist = unique(list(data.shortlist, value => {
    const row = record(value);
    return { id: id(row.id), brand: text(row.brand), model: text(row.model), budget: number(row.budget),
      status: choice(row.status, ["New", "Test drive"]), notes: text(row.notes, 10000),
      ...(row.variant === undefined ? {} : { variant: text(row.variant) }),
      ...(row.state === undefined ? {} : { state: text(row.state) }),
      ...(row.priceSource === undefined ? {} : { priceSource: text(row.priceSource) }) };
  }));
  const result: PrivateWorkspace = { version: 1,
    profile: { displayName: text(profile.displayName), city: text(profile.city), garageRole: choice(profile.garageRole, ["Owner", "Buyer", "Enthusiast", "Mechanic"]) },
    garage, timeline, shortlist,
    follows: { models: list(follows.models, value => text(value)), topics: list(follows.topics, value => text(value)) },
    saved: list(data.saved, id),
  };
  // Pretty JSON conservatively accounts for the spaces added by PostgreSQL jsonb::text.
  if (new TextEncoder().encode(JSON.stringify(result, null, 1)).length > 1_000_000) invalid();
  return result;
}

function decodeRow(value: unknown, owner: string): CloudWorkspace {
  const row = record(value);
  if (row.user_id !== owner || !Number.isSafeInteger(row.revision) || Number(row.revision) < 1 || !Number.isFinite(Date.parse(text(row.updated_at)))) invalid();
  return { payload: parsePrivateWorkspace(row.payload), revision: row.revision as number, updatedAt: row.updated_at as string };
}

function cloudError(code?: string): Error {
  if (code === "40001" || code === "23505") return new Error("Your account copy changed on another device. Refresh before saving again.");
  if (["PGRST205", "PGRST202", "42P01", "42883"].includes(code ?? "")) return new Error("Account saving is not set up yet. Your device copy is unchanged.");
  return new Error("Could not access your account copy. Check your connection and sign-in, then retry. Your device copy is unchanged.");
}

export async function loadCloudWorkspace(client: SupabaseClient, owner: string): Promise<CloudWorkspace | null> {
  const { data, error } = await client.from("otofolks_private_workspaces").select("user_id,payload,revision,updated_at").eq("user_id", owner).abortSignal(AbortSignal.timeout(15000)).maybeSingle().retry(false);
  if (error) throw cloudError(error.code);
  return data === null ? null : decodeRow(data, owner);
}

export async function saveCloudWorkspace(client: SupabaseClient, owner: string, payload: PrivateWorkspace, revision: number): Promise<CloudWorkspace> {
  if (!Number.isSafeInteger(revision) || revision < 0) invalid();
  const { data, error } = await client.rpc("save_otofolks_private_workspace", {
    p_payload: parsePrivateWorkspace(payload), p_expected_revision: revision,
  }).abortSignal(AbortSignal.timeout(15000)).single();
  if (error) throw cloudError(error.code);
  return decodeRow(data, owner);
}
