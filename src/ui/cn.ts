/**
 * `cn` — the one class-name merge helper for the AutoFlex design system.
 *
 * Why this exists: every primitive takes a `className` and has to combine it
 * with its own base classes. Doing that with template strings produces two
 * failure modes that are invisible in review and obvious on a phone:
 * a conditional that renders `undefined` into the attribute, and a missing
 * space between two concatenated fragments that silently deletes a class.
 * `cn` removes both by construction, so no primitive in `src/ui` builds a
 * class string by hand.
 *
 * It deliberately does *not* resolve Tailwind conflicts (`p-2 p-4`): the
 * cascade already decides those by stylesheet order, and a real conflict is a
 * design bug that should be fixed at the call site rather than papered over.
 * Duplicate identical tokens are collapsed so repeated merges stay readable in
 * dev tools.
 */
export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };

const push = (out: string[], value: ClassValue): void => {
  if (!value && value !== 0) return;
  if (typeof value === "string" || typeof value === "number") {
    for (const token of String(value).split(/\s+/)) if (token) out.push(token);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) push(out, entry);
    return;
  }
  for (const [key, enabled] of Object.entries(value)) if (enabled) push(out, key);
};

export function cn(...values: ClassValue[]): string {
  const tokens: string[] = [];
  for (const value of values) push(tokens, value);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    unique.push(token);
  }
  return unique.join(" ");
}

/**
 * The shared keyboard focus treatment.
 *
 * `:focus-visible` only — a mouse press must not leave a ring behind, but every
 * keyboard route into a control must be visible on a cheap LCD in daylight, so
 * the ring is 2px of `primary` offset against `surface`. Never use `:focus`.
 */
export const focusRing =
  "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * Minimum interactive box. Android accessibility guidance is 48dp; the product
 * baseline here is 44px, applied to every control the design system owns.
 */
export const touchTarget = "min-h-[44px]";
