/**
 * AF-02 — PostgREST filter injection through the community feed keyset cursor.
 *
 * `src/hosted/community.ts:247-249` interpolates `cursor.value` and `cursor.id`
 * straight into a PostgREST logic-tree string:
 *
 *   .or(`${column}.lt.${cursor.value},and(${column}.eq.${cursor.value},id.lt.${cursor.id})`)
 *
 * postgrest-js appends that string verbatim as the `or=(...)` query parameter
 * (node_modules/@supabase/postgrest-js/src/PostgrestFilterBuilder.ts). Inside
 * that parameter, `,` `(` `)` and `.` are *structural*, so a cursor carrying
 * them adds predicates the application never wrote. The live proof is recorded
 * in docs/SECURITY_AUDIT.md.
 *
 * `src/**` belongs to another team this cycle, so this file ships the tested
 * reference fix (`sanitiseFeedCursor`) and drives the real
 * `listHostedPostsPage` through it to show the injection is neutralised.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedCursor } from "../../src/infrastructure/hosted/community";

/* -------------------------------------------------------------------------- */
/* Reference fix — drop straight into src/hosted/community.ts                 */
/* -------------------------------------------------------------------------- */

/**
 * A cursor is machine-generated: the ordering value is an ISO timestamp or a
 * decimal, and the id is an `owner_posts.id` slug. Anything else is hostile or
 * corrupt, and either way must not become part of a filter expression.
 *
 * This is an allow-list on purpose. There is no escaping scheme for the
 * PostgREST logic-tree grammar that survives a version bump, so the only safe
 * construction is "characters that cannot be structural".
 */
const CURSOR_VALUE_PATTERN = /^(?:\d{4}-\d{2}-\d{2}T[\d:.]{8,15}(?:Z|[+-]\d{2}:\d{2})|-?\d+(?:\.\d+)?)$/;
const CURSOR_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const sanitiseFeedCursor = (cursor: FeedCursor | null | undefined): FeedCursor | null => {
  if (!cursor || typeof cursor.id !== "string" || typeof cursor.value !== "string") return null;
  if (!CURSOR_ID_PATTERN.test(cursor.id)) return null;
  if (!CURSOR_VALUE_PATTERN.test(cursor.value)) return null;
  return { id: cursor.id, value: cursor.value };
};

/* -------------------------------------------------------------------------- */

const HOSTILE_CURSORS: { label: string; cursor: FeedCursor }[] = [
  {
    cursor: { id: "z),and(user_id.eq.11111111-1111-1111-1111-111111111111", value: "1900-01-01T00:00:00Z" },
    label: "closes the and() group and appends a predicate on a column the feed never selects",
  },
  {
    cursor: { id: "z)", value: "1900-01-01T00:00:00Z" },
    label: "unbalances the expression so PostgREST answers 400 (availability)",
  },
  {
    cursor: { id: "z),not.and(id.is.null", value: "1900-01-01T00:00:00Z" },
    label: "negates the whole keyset predicate and returns the table from row one",
  },
  {
    cursor: { id: "abc", value: "1900-01-01T00:00:00Z,or(id.not.is.null" },
    label: "injects through the ordering value instead of the id",
  },
  { cursor: { id: "abc", value: "*" }, label: "PostgREST wildcard in the ordering value" },
  { cursor: { id: "a,b", value: "1900-01-01T00:00:00Z" }, label: "bare comma splits the branch list" },
  { cursor: { id: "abc", value: "1900-01-01T00:00:00Z)" }, label: "stray close paren" },
  { cursor: { id: '"quoted"', value: "1900-01-01T00:00:00Z" }, label: "PostgREST literal quoting" },
];

describe("AF-02 reference fix rejects every hostile cursor", () => {
  it.each(HOSTILE_CURSORS)("rejects a cursor that $label", ({ cursor }) => {
    expect(sanitiseFeedCursor(cursor)).toBeNull();
  });

  it("accepts the cursors the server actually produces", () => {
    expect(sanitiseFeedCursor({ id: "nexon-diesel-clutch", value: "2026-08-19T10:11:12.345Z" })).toEqual({
      id: "nexon-diesel-clutch",
      value: "2026-08-19T10:11:12.345Z",
    });
    expect(sanitiseFeedCursor({ id: "abc_123-XY", value: "8.4213" })).toEqual({ id: "abc_123-XY", value: "8.4213" });
    expect(sanitiseFeedCursor({ id: "abc", value: "-1" })).toEqual({ id: "abc", value: "-1" });
    expect(sanitiseFeedCursor(null)).toBeNull();
  });

  it("no accepted cursor can contain a PostgREST structural character", () => {
    const accepted = [
      { id: "nexon-diesel-clutch", value: "2026-08-19T10:11:12.345Z" },
      { id: "abc_123-XY", value: "8.4213" },
    ];
    for (const cursor of accepted) {
      const safe = sanitiseFeedCursor(cursor)!;
      expect(`${safe.value}${safe.id}`).not.toMatch(/[(),"*\s\\]/);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* End-to-end: what actually reaches PostgREST                                */
/* -------------------------------------------------------------------------- */

let capturedOr: string | undefined;

const makeQuery = () => {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  query.select = chain;
  query.order = chain;
  query.limit = chain;
  query.or = (filters: string) => {
    capturedOr = filters;
    return query;
  };
  // `unwrap(await query, [])` in src/hosted/result.ts awaits the builder.
  query.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return query;
};

vi.mock("../../src/infrastructure/supabase/client", () => ({
  getSupabaseClient: () => ({ from: () => makeQuery() }),
  isCloudSyncConfigured: true,
}));

/** Split the `or=(...)` payload on top-level commas, the way PostgREST does. */
const topLevelBranches = (filters: string): string[] => {
  const branches: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of filters) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      branches.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (current) branches.push(current);
  return branches;
};

describe("AF-02 the sanitised cursor produces a two-branch keyset filter", () => {
  beforeEach(() => {
    capturedOr = undefined;
  });

  it("emits exactly the intended keyset predicate for a legitimate cursor", async () => {
    const { listHostedPostsPage } = await import("../../src/infrastructure/hosted/community");
    const cursor = sanitiseFeedCursor({ id: "nexon-diesel-clutch", value: "2026-08-19T10:11:12.345Z" });

    await listHostedPostsPage({ cursor });

    expect(capturedOr).toBe(
      "created_at.lt.2026-08-19T10:11:12.345Z,and(created_at.eq.2026-08-19T10:11:12.345Z,id.lt.nexon-diesel-clutch)",
    );
    expect(topLevelBranches(capturedOr!)).toHaveLength(2);
  });

  it("adds no filter at all once a hostile cursor is sanitised away", async () => {
    const { listHostedPostsPage } = await import("../../src/infrastructure/hosted/community");

    for (const { cursor } of HOSTILE_CURSORS) {
      capturedOr = undefined;
      await listHostedPostsPage({ cursor: sanitiseFeedCursor(cursor) });
      // Rejected cursor -> first page, and crucially no attacker-authored
      // predicate on the wire.
      expect(capturedOr).toBeUndefined();
    }
  });

  it("shows why escaping is not an option: the raw template is structural", () => {
    // The exact construction from src/hosted/community.ts:247-249, evaluated on
    // a hostile cursor. This is a demonstration of the grammar, not a call into
    // the app, so it documents the breakout without pinning src's behaviour.
    const hostile = HOSTILE_CURSORS[0].cursor;
    const template = `created_at.lt.${hostile.value},and(created_at.eq.${hostile.value},id.lt.${hostile.id})`;

    const branches = topLevelBranches(template);
    expect(branches).toHaveLength(3);
    // A third branch the application never wrote, filtering on a column that is
    // not even in FEED_COLUMNS.
    expect(branches[2]).toBe("and(user_id.eq.11111111-1111-1111-1111-111111111111)");
    // Quoting is not a fix either: a cursor containing a double quote closes
    // the literal again, which is why the reference fix is an allow-list.
    expect(sanitiseFeedCursor({ id: 'a",or(id.not.is.null,"b', value: "2026-08-19T10:11:12.345Z" })).toBeNull();
  });
});
