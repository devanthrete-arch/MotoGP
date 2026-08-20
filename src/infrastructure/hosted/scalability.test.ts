import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeFeedCursor, encodeFeedCursor, FEED_MAX_ROWS, FEED_PAGE_SIZE } from "./community";
import { flushStoredJson, readStoredJson, writeStoredJson } from "../storage/localStore";

const communitySource = readFileSync(new URL("./community.ts", import.meta.url), "utf8");
const syncSource = readFileSync(new URL("./syncAll.ts", import.meta.url), "utf8");

/**
 * These are guard rails, not unit tests. The feed once loaded every post and
 * every comment in the database on each page load; each assertion below fails
 * if that class of mistake comes back.
 */
describe("feed query guard rails", () => {
  it("never selects * from the two unbounded community tables", () => {
    for (const source of [communitySource, syncSource]) {
      expect(source).not.toMatch(/from\("owner_posts"\)\s*\.select\("\*"\)/);
      expect(source).not.toMatch(/from\("post_comments"\)\s*\.select\("\*"\)/);
    }
  });

  it("bounds every owner_posts and post_comments read with a limit", () => {
    const reads = communitySource.match(/from\("(owner_posts|post_comments)"\)[\s\S]*?;/g) ?? [];
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) {
      // Writes (upsert/update/delete) do not need a limit; reads do.
      if (!read.includes(".select(")) continue;
      expect(read).toMatch(/\.limit\(/);
    }
  });

  it("never paginates with OFFSET, whose cost grows with depth", () => {
    // Match calls, not prose: the source deliberately mentions OFFSET in a
    // comment explaining why it is not used.
    const withoutComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const source of [communitySource, syncSource]) {
      const code = withoutComments(source);
      expect(code).not.toMatch(/\.range\s*\(/);
      expect(code).not.toMatch(/\boffset\s*[(:]/i);
    }
  });

  it("does not pull comment bodies during a workspace sync", () => {
    expect(syncSource).not.toContain("selectCommentRows(");
  });

  it("keeps page sizes sane", () => {
    expect(FEED_PAGE_SIZE).toBeGreaterThan(0);
    expect(FEED_PAGE_SIZE).toBeLessThanOrEqual(50);
    expect(FEED_MAX_ROWS).toBeLessThanOrEqual(500);
  });
});

describe("keyset cursor", () => {
  it("round trips a cursor", () => {
    const cursor = { id: "post-9", value: "2026-08-19T10:00:00.000Z" };
    expect(decodeFeedCursor(encodeFeedCursor(cursor))).toEqual(cursor);
  });

  it("survives an ordering value that itself contains the separator", () => {
    const cursor = { id: "post-1", value: "a|b|c" };
    expect(decodeFeedCursor(encodeFeedCursor(cursor))).toEqual(cursor);
  });

  it("treats malformed or empty cursors as the first page", () => {
    expect(decodeFeedCursor("")).toBeNull();
    expect(decodeFeedCursor(null)).toBeNull();
    expect(decodeFeedCursor("|no-value")).toBeNull();
    expect(decodeFeedCursor("no-id|")).toBeNull();
    expect(encodeFeedCursor(null)).toBe("");
  });
});

describe("coalesced storage writes", () => {
  const makeStorage = () => {
    const map = new Map<string, string>();
    let writes = 0;
    return {
      writes: () => writes,
      store: {
        getItem: (key: string) => map.get(key) ?? null,
        removeItem: (key: string) => void map.delete(key),
        setItem: (key: string, value: string) => {
          writes += 1;
          map.set(key, value);
        },
      },
    };
  };

  it("collapses a burst of writes to one serialisation, keeping the last value", () => {
    const { store, writes } = makeStorage();
    for (let index = 0; index < 25; index += 1) writeStoredJson("burst", { index }, store);
    flushStoredJson(store);
    expect(writes()).toBe(1);
    expect(JSON.parse(store.getItem("burst") as string)).toEqual({ index: 24 });
  });

  it("serves a read from the buffer before it reaches storage", () => {
    const { store } = makeStorage();
    writeStoredJson("pending", { fresh: true }, store);
    // Deliberately not flushed: the read must still see the newest value.
    expect(readStoredJson("pending", { fresh: false }, store)).toEqual({ fresh: true });
    flushStoredJson(store);
    expect(readStoredJson("pending", { fresh: false }, store)).toEqual({ fresh: true });
  });

  it("loses nothing when several keys are pending at once", () => {
    const { store } = makeStorage();
    writeStoredJson("a", 1, store);
    writeStoredJson("b", 2, store);
    writeStoredJson("a", 3, store);
    flushStoredJson(store);
    expect(readStoredJson("a", 0, store)).toBe(3);
    expect(readStoredJson("b", 0, store)).toBe(2);
  });

  it("is a no-op when there is nothing buffered", () => {
    const { store, writes } = makeStorage();
    flushStoredJson(store);
    expect(writes()).toBe(0);
  });
});
