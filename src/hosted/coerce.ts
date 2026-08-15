/**
 * Pure coercion helpers shared by every hosted mapper.
 *
 * Hosted rows are typed but the database can still hand back values the local
 * app never expects (unknown enum members added by a later migration, nulls in
 * columns that used to be non-null, numeric columns arriving as strings from
 * PostgREST). Every helper here is total: it always returns a usable local
 * value and never throws, so a mapper can never break a render.
 */

export const nowIso = (): string => new Date().toISOString();

export const asText = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return fallback;
};

export const asTrimmedText = (value: unknown, fallback = ""): string => {
  const text = asText(value, fallback).trim();
  return text || fallback.trim();
};

export const asFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

/** Non-negative integer, matching the `>= 0` checks on hosted counters. */
export const asCount = (value: unknown, fallback = 0): number => {
  const parsed = Math.trunc(asFiniteNumber(value, fallback));
  return parsed > 0 ? parsed : 0;
};

/** Non-negative money amount; hosted numeric columns arrive as number or string. */
export const asAmount = (value: unknown, fallback = 0): number => {
  const parsed = asFiniteNumber(value, fallback);
  return parsed > 0 ? parsed : 0;
};

export const asBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

export const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];

/** Unknown enum values collapse to the safe local default instead of leaking through. */
export const asOneOf = <Value extends string>(value: unknown, allowed: readonly Value[], fallback: Value): Value =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as Value) : fallback;

export const asIsoTimestamp = (value: unknown, fallback: string = nowIso()): string => {
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return fallback;
};

export const asNullableIsoTimestamp = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
};

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD`, which is what the local timeline uses and what `date` columns expect. */
export const asDateOnly = (value: unknown, fallback: string = nowIso().slice(0, 10)): string => {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (dateOnlyPattern.test(trimmed)) return trimmed;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  }
  return dateOnlyPattern.test(fallback) ? fallback : nowIso().slice(0, 10);
};

export const asNullableDateOnly = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (dateOnlyPattern.test(trimmed)) return trimmed;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
};

/** Matches the `^[a-z0-9]+(-[a-z0-9]+)*$` check on `city_circles.slug`. */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Milliseconds since epoch, or 0 when the value is missing or unparseable. */
export const timestampOf = (value: unknown): number => {
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const byIdMap = <Value extends { id: string }>(values: Value[]): Map<string, Value> =>
  new Map(values.map((value) => [value.id, value]));
