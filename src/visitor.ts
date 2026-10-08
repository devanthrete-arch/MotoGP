// What a browser tab remembers for someone who has not signed in yet, and one device-level hint.
//
// A visitor's registration number and Compare shortlist live in sessionStorage: they belong to
// this tab, survive the page load that ends a sign-in, and are never read from the shared,
// un-prefixed localStorage keys that an earlier user of this browser may have filled.
//
// Every function takes its storage as an argument so it can be tested, and none throws: storage
// can be missing (server-side tests) or blocked (private modes).
import type { ShortlistItem } from "./domain";
import { loadShortlist, saveShortlist } from "./storage";
import { parseRegistration } from "./ui/plate";

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const pendingPlateKey = "otofolks.pending-plate.v1";
const visitorShortlistKey = "otofolks.visitor-shortlist.v1";
const tabOwnerKey = "otofolks.tab-member.v1";
const signingInKey = "otofolks.signing-in.v1";
const memberHintKey = "otofolks.member-hint.v1";

const tabStorage = (): KeyValueStorage | null => {
  try { return globalThis.sessionStorage ?? null; } catch { return null; }
};
const deviceStorage = (): KeyValueStorage | null => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};
const read = (storage: KeyValueStorage | null, key: string): string | null => {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
};
const write = (storage: KeyValueStorage | null, key: string, value: string | null): void => {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch { /* Not remembered; the visitor can type it again. */ }
};

/** Keeps the number typed on the landing page until its vehicle is saved. Pass the normalised form. */
export const rememberPlate = (normalized: string, storage = tabStorage()): void =>
  write(storage, pendingPlateKey, normalized);

/** The remembered number in normalised form, or null. Anything that is not a whole number is ignored. */
export const recallPlate = (storage = tabStorage()): string | null => {
  const parsed = parseRegistration(read(storage, pendingPlateKey) ?? "");
  return parsed.ok ? parsed.normalized : null;
};

export const forgetPlate = (storage = tabStorage()): void => write(storage, pendingPlateKey, null);

// The same limits the account copy enforces (src/cloudWorkspace.ts), so nothing carried into an
// account can later make "Save to account" fail.
const isShortlistItem = (value: unknown): value is ShortlistItem => {
  if (value === null || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const text = (field: unknown, max = 500) => typeof field === "string" && field.length <= max;
  const optionalText = (field: unknown) => field === undefined || text(field);
  return text(item.id, 250) && (item.id as string).trim() !== "" && text(item.brand) && text(item.model)
    && typeof item.budget === "number" && Number.isFinite(item.budget) && item.budget >= 0 && item.budget <= 1e12
    && (item.status === "New" || item.status === "Test drive") && text(item.notes, 10_000)
    && optionalText(item.variant) && optionalText(item.state) && optionalText(item.priceSource);
};

export const loadVisitorShortlist = (storage = tabStorage()): ShortlistItem[] => {
  try {
    const stored: unknown = JSON.parse(read(storage, visitorShortlistKey) ?? "[]");
    return Array.isArray(stored) ? stored.filter(isShortlistItem) : [];
  } catch {
    return [];
  }
};

export const saveVisitorShortlist = (items: ShortlistItem[], storage = tabStorage()): void =>
  write(storage, visitorShortlistKey, items.length ? JSON.stringify(items) : null);

/**
 * A visitor's cars in front of the ones the account already has. A car the account already lists
 * (same brand, model, variant and state, the rule Compare itself uses) is not added twice, and
 * ids stay unique.
 */
export function mergeShortlists(visiting: ShortlistItem[], existing: ShortlistItem[]): ShortlistItem[] {
  const sameCar = (first: ShortlistItem, second: ShortlistItem) => first.brand === second.brand
    && first.model === second.model && first.variant === second.variant && first.state === second.state;
  const taken = new Set(existing.map((item) => item.id));
  const added: ShortlistItem[] = [];
  for (const item of visiting) {
    if ([...existing, ...added].some((other) => sameCar(other, item))) continue;
    let id = item.id;
    for (let copy = 2; taken.has(id); copy++) id = `${item.id}-${copy}`;
    taken.add(id);
    added.push(id === item.id ? item : { ...item, id });
  }
  return [...added, ...existing];
}

/**
 * Moves this tab's visitor shortlist into the signed-in account's device data and returns the
 * account's shortlist to show. Call it only after setStorageUser has named the account.
 *
 * The tab's copy is dropped only once the account's storage is seen to hold the cars. If that
 * write did not land (storage full or blocked) the tab keeps them and they are still shown, so
 * running this twice, or being interrupted, neither loses nor duplicates a car.
 */
export function adoptVisitorShortlist(storage = tabStorage()): ShortlistItem[] {
  const existing = loadShortlist();
  const visiting = loadVisitorShortlist(storage);
  if (!visiting.length) return existing;
  const merged = mergeShortlists(visiting, existing);
  saveShortlist(merged);
  const kept = new Set(loadShortlist().map((item) => item.id));
  if (merged.every((item) => kept.has(item.id))) saveVisitorShortlist([], storage);
  return merged;
}

/** Everything a tab holds for a visitor. */
export function forgetVisitorData(storage = tabStorage()): void {
  forgetPlate(storage);
  saveVisitorShortlist([], storage);
}

/**
 * Keeps what a tab holds from passing to the wrong person. Call it on every render, before
 * anything reads the tab, with who is signed in (null for nobody) and whether that is settled
 * (the sign-in provider has answered).
 *
 * What a visitor typed belongs to whoever signs in next in that tab, once: the tab is then marked
 * as that member's. When the tab is later seen signed out, or signed in as someone else, whatever
 * it still holds is dropped, however the session ended (the app's own button, the provider's
 * menu, another tab, an expired session). Returns true when it dropped something, so state that
 * was already read can be reset.
 */
export function claimTab(accountId: string | null, settled: boolean, storage = tabStorage()): boolean {
  const owner = read(storage, tabOwnerKey);
  if (accountId !== null) {
    if (owner === accountId) return false;
    write(storage, tabOwnerKey, accountId);
    if (owner === null) return false;
    forgetVisitorData(storage);
    return true;
  }
  // While it is not yet known who is here, a member's own reload must not empty their tab.
  if (!settled || owner === null) return false;
  write(storage, tabOwnerKey, null);
  forgetVisitorData(storage);
  return true;
}

/**
 * Whether this device was signed in the last time the app knew. It only decides what to draw
 * while sign-in is still loading: a placeholder for a returning member, the landing page for
 * everyone else. It grants nothing.
 */
export const readMemberHint = (storage = deviceStorage()): boolean => read(storage, memberHintKey) === "1";
export const writeMemberHint = (member: boolean, storage = deviceStorage()): void =>
  write(storage, memberHintKey, member ? "1" : null);

/**
 * A sign-in was started in this tab. The page load that ends it should wait for the answer rather
 * than flash the visitor's page. Kept in the tab, not on the device: pressing "Sign in" and then
 * closing the window must not make the device look like a member's on later visits.
 */
export const readSigningIn = (storage = tabStorage()): boolean => read(storage, signingInKey) === "1";
export const writeSigningIn = (signingIn: boolean, storage = tabStorage()): void =>
  write(storage, signingInKey, signingIn ? "1" : null);
