import { describe, expect, it } from "vitest";
import {
  CACHE_TTL,
  createHostedCache,
  DEFAULT_MAX_ENTRIES,
  hostedCache,
  ownerKey,
  publicKey,
  readThroughCache,
  clearHostedCache,
} from "./cache";
import { hostedFallback, hostedOk, type HostedResult } from "./result";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Manual clock so the suite never sleeps. */
const clock = () => {
  let value = 1_000;
  return {
    advance: (ms: number) => {
      value += ms;
    },
    now: () => value,
  };
};

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

/** Lets pending microtasks and fire-and-forget revalidations settle. */
const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const okLoader = <T>(value: T, calls: { count: number }) => {
  return async (): Promise<HostedResult<T>> => {
    calls.count += 1;
    return hostedOk(value);
  };
};

const failLoader = <T>(calls: { count: number }) => {
  return async (): Promise<HostedResult<T>> => {
    calls.count += 1;
    return hostedFallback(undefined as unknown as T, "request-failed", "boom");
  };
};

/* -------------------------------------------------------------------------- */
/* Keys                                                                       */
/* -------------------------------------------------------------------------- */

describe("cache keys", () => {
  it("gives public data one shared key", () => {
    expect(publicKey("city-circles", "all")).toBe(publicKey("city-circles", "all"));
    expect(publicKey("city-circles", "pune")).not.toBe(publicKey("city-circles", "mumbai"));
  });

  it("namespaces owner-scoped data by user id so one user can never read another's", () => {
    const first = ownerKey("user-a", "garage");
    const second = ownerKey("user-b", "garage");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);
    expect(String(first)).toContain("user-a");
  });

  it("refuses to build an owner key without a user id, so the read bypasses the cache", () => {
    expect(ownerKey(null, "garage")).toBeNull();
    expect(ownerKey(undefined, "garage")).toBeNull();
    expect(ownerKey("   ", "garage")).toBeNull();
  });

  it("escapes separators so crafted ids cannot collide with another key", () => {
    expect(publicKey("feed", "a|b")).not.toBe(publicKey("feed", "a", "b"));
    expect(ownerKey("a:b", "garage")).not.toBe(ownerKey("a", "b:garage"));
  });

  it("keeps a null key out of the store entirely", async () => {
    const cache = createHostedCache({ now: clock().now });
    const calls = { count: 0 };
    await cache.read(ownerKey("", "garage"), [], okLoader(["v"], calls));
    await cache.read(ownerKey("", "garage"), [], okLoader(["v"], calls));
    expect(calls.count).toBe(2);
    expect(cache.size).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* TTL                                                                        */
/* -------------------------------------------------------------------------- */

describe("ttl", () => {
  it("serves a fresh entry without touching the loader", async () => {
    const time = clock();
    const cache = createHostedCache({ now: time.now, staleMs: 0, ttlMs: 1_000 });
    const calls = { count: 0 };
    const key = publicKey("city-circles", "all");

    const first = await cache.read(key, [], okLoader(["pune"], calls));
    time.advance(500);
    const second = await cache.read(key, [], okLoader(["pune"], calls));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.data).toEqual(["pune"]);
    expect(calls.count).toBe(1);
  });

  it("refetches once the entry is past ttl and past the stale window", async () => {
    const time = clock();
    const cache = createHostedCache({ now: time.now, staleMs: 0, ttlMs: 1_000 });
    const calls = { count: 0 };
    const key = publicKey("city-circles", "all");

    await cache.read(key, [], okLoader(["v1"], calls));
    time.advance(1_001);
    const second = await cache.read(key, [], okLoader(["v2"], calls));

    expect(calls.count).toBe(2);
    expect(second.data).toEqual(["v2"]);
  });

  it("honours a per-read ttl override", async () => {
    const time = clock();
    const cache = createHostedCache({ now: time.now, staleMs: 0, ttlMs: 1_000_000 });
    const calls = { count: 0 };
    const key = publicKey("feed", "recent");

    await cache.read(key, [], okLoader(["v1"], calls), { staleMs: 0, ttlMs: 10 });
    time.advance(50);
    await cache.read(key, [], okLoader(["v2"], calls), { staleMs: 0, ttlMs: 10 });

    expect(calls.count).toBe(2);
  });

  it("forceRefresh bypasses a fresh entry", async () => {
    const time = clock();
    const cache = createHostedCache({ now: time.now, ttlMs: 1_000_000 });
    const calls = { count: 0 };
    const key = publicKey("feed", "recent");

    await cache.read(key, [], okLoader(["v1"], calls));
    const second = await cache.read(key, [], okLoader(["v2"], calls), { forceRefresh: true });

    expect(calls.count).toBe(2);
    expect(second.data).toEqual(["v2"]);
  });

  it("does not thrash the network when the device clock jumps backwards", async () => {
    const time = clock();
    const cache = createHostedCache({ now: time.now, staleMs: 0, ttlMs: 1_000 });
    const calls = { count: 0 };
    const key = publicKey("feed", "recent");

    await cache.read(key, [], okLoader(["v1"], calls));
    time.advance(-60_000);
    await cache.read(key, [], okLoader(["v2"], calls));

    expect(calls.count).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Deduplication                                                              */
/* -------------------------------------------------------------------------- */

describe("in-flight deduplication", () => {
  it("collapses concurrent callers for the same key onto one request", async () => {
    const cache = createHostedCache({ now: clock().now });
    const gate = deferred<void>();
    let calls = 0;
    const load = async (): Promise<HostedResult<string[]>> => {
      calls += 1;
      await gate.promise;
      return hostedOk(["page-1"]);
    };
    const key = publicKey("feed", "recent", 30, "");

    const inFlight = [
      cache.read(key, [], load),
      cache.read(key, [], load),
      cache.read(key, [], load),
      cache.read(key, [], load),
      cache.read(key, [], load),
    ];
    gate.resolve();
    const results = await Promise.all(inFlight);

    expect(calls).toBe(1);
    expect(cache.snapshot().dedupes).toBe(4);
    for (const result of results) {
      expect(result.ok).toBe(true);
      expect(result.data).toEqual(["page-1"]);
    }
  });

  it("does not collapse different keys", async () => {
    const cache = createHostedCache({ now: clock().now });
    let calls = 0;
    const load = async (): Promise<HostedResult<string>> => {
      calls += 1;
      return hostedOk("v");
    };

    await Promise.all([
      cache.read(publicKey("feed", "recent"), "", load),
      cache.read(publicKey("feed", "ranked"), "", load),
    ]);

    expect(calls).toBe(2);
  });

  it("gives each deduplicated caller its own fallback when the request fails", async () => {
    const cache = createHostedCache({ now: clock().now });
    const gate = deferred<void>();
    const load = async (): Promise<HostedResult<string[]>> => {
      await gate.promise;
      return hostedFallback([] as string[], "request-failed", "network down");
    };
    const key = publicKey("feed", "recent");

    const both = [cache.read(key, ["local-a"], load), cache.read(key, ["local-b"], load)];
    gate.resolve();
    const [first, second] = await Promise.all(both);

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    // A shared promise must not leak one caller's local data to the other.
    expect(first.data).toEqual(["local-a"]);
    expect(second.data).toEqual(["local-b"]);
  });

  it("clears the in-flight slot so a later call can fetch again", async () => {
    const time = clock();
    const cache = createHostedCache({ now: time.now, staleMs: 0, ttlMs: 0 });
    const calls = { count: 0 };
    const key = publicKey("feed", "recent");

    await cache.read(key, [], okLoader(["v"], calls));
    time.advance(1);
    await cache.read(key, [], okLoader(["v"], calls));

    expect(calls.count).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/* LRU                                                                        */
/* -------------------------------------------------------------------------- */

describe("lru eviction", () => {
  it("never grows past maxEntries", async () => {
    const cache = createHostedCache({ maxEntries: 3, now: clock().now });
    for (let index = 0; index < 20; index += 1) {
      await cache.read(publicKey("feed", index), "", okLoader(`v${index}`, { count: 0 }));
    }
    expect(cache.size).toBe(3);
    expect(cache.snapshot().evictions).toBe(17);
  });

  it("evicts the least recently used entry, not the oldest written", async () => {
    const cache = createHostedCache({ maxEntries: 3, now: clock().now, ttlMs: 1_000_000 });
    const noop = { count: 0 };
    const a = publicKey("k", "a");
    const b = publicKey("k", "b");
    const c = publicKey("k", "c");
    const d = publicKey("k", "d");

    await cache.read(a, "", okLoader("a", noop));
    await cache.read(b, "", okLoader("b", noop));
    await cache.read(c, "", okLoader("c", noop));
    // Reading `a` promotes it, so `b` becomes the eviction candidate.
    await cache.read(a, "", okLoader("a", noop));
    await cache.read(d, "", okLoader("d", noop));

    expect(cache.keys()).toEqual([String(c), String(a), String(d)]);
    expect(cache.peek(b)).toBeNull();
    expect(cache.peek(a)).toBe("a");
  });

  it("defaults to a bound small enough for a low-end phone", () => {
    expect(DEFAULT_MAX_ENTRIES).toBeLessThanOrEqual(128);
    expect(DEFAULT_MAX_ENTRIES).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Stale-while-revalidate                                                     */
/* -------------------------------------------------------------------------- */

describe("stale-while-revalidate", () => {
  it("returns the stale value immediately and refreshes behind it", async () => {
    const time = clock();
    const cache = createHostedCache({ now: time.now, staleMs: 10_000, ttlMs: 1_000 });
    const key = publicKey("playbooks", "all");
    const calls = { count: 0 };

    await cache.read(key, [], okLoader(["v1"], calls));
    time.advance(2_000);

    const gate = deferred<void>();
    const slow = async (): Promise<HostedResult<string[]>> => {
      calls.count += 1;
      await gate.promise;
      return hostedOk(["v2"]);
    };

    const stale = await cache.read(key, [], slow);
    // The caller was served without waiting for the refresh.
    expect(stale.ok).toBe(true);
    expect(stale.data).toEqual(["v1"]);
    expect(calls.count).toBe(2);

    gate.resolve();
    await flush();
    expect(cache.peek(key)).toEqual(["v2"]);
    expect(cache.snapshot().staleHits).toBe(1);
    expect(cache.snapshot().revalidations).toBe(1);
  });

  it("only launches one background refresh for a burst of stale reads", async () => {
    const time = clock();
    const cache = createHostedCache({ now: time.now, staleMs: 10_000, ttlMs: 1_000 });
    const key = publicKey("playbooks", "all");
    const calls = { count: 0 };

    await cache.read(key, [], okLoader(["v1"], calls));
    time.advance(2_000);

    const gate = deferred<void>();
    const slow = async (): Promise<HostedResult<string[]>> => {
      calls.count += 1;
      await gate.promise;
      return hostedOk(["v2"]);
    };

    await Promise.all([cache.read(key, [], slow), cache.read(key, [], slow), cache.read(key, [], slow)]);
    gate.resolve();
    await flush();

    expect(calls.count).toBe(2); // one initial fill, one refresh
  });

  it("stops serving a stale value once the stale window itself expires", async () => {
    const time = clock();
    const cache = createHostedCache({ now: time.now, staleMs: 5_000, ttlMs: 1_000 });
    const key = publicKey("playbooks", "all");
    const calls = { count: 0 };

    await cache.read(key, [], okLoader(["v1"], calls));
    time.advance(6_001);
    const result = await cache.read(key, [], okLoader(["v2"], calls));

    expect(result.data).toEqual(["v2"]);
    expect(calls.count).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/* Failure behaviour                                                          */
/* -------------------------------------------------------------------------- */

describe("failure keeps the last good value", () => {
  it("keeps serving the last good value when a background refresh fails", async () => {
    const time = clock();
    const cache = createHostedCache({ now: time.now, staleMs: 10_000, ttlMs: 1_000 });
    const key = publicKey("city-circles", "all");
    const fills = { count: 0 };

    await cache.read(key, [], okLoader(["good"], fills));
    time.advance(2_000);

    const failures = { count: 0 };
    const stale = await cache.read(key, [], failLoader<string[]>(failures));
    await flush();

    expect(stale.ok).toBe(true);
    expect(stale.data).toEqual(["good"]);
    expect(cache.peek(key)).toEqual(["good"]);
    expect(cache.snapshot().failedRevalidations).toBe(1);

    // Still inside the stale window, so the next reader gets the good value too.
    const next = await cache.read(key, [], failLoader<string[]>(failures));
    expect(next.data).toEqual(["good"]);
  });

  it("returns the failure arm carrying the last good value once fully expired", async () => {
    const time = clock();
    const cache = createHostedCache({ now: time.now, staleMs: 1_000, ttlMs: 1_000 });
    const key = publicKey("city-circles", "all");

    await cache.read(key, [], okLoader(["good"], { count: 0 }));
    time.advance(10_000);
    const result = await cache.read(key, ["caller-local"], failLoader<string[]>({ count: 0 }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.source).toBe("local");
    expect(result.reason).toBe("request-failed");
    // Last good server value beats the caller's local fallback, and nothing threw.
    expect(result.data).toEqual(["good"]);
  });

  it("falls back to the caller's local value when there is nothing cached", async () => {
    const cache = createHostedCache({ now: clock().now });
    const result = await cache.read(publicKey("city-circles", "all"), ["local"], failLoader<string[]>({ count: 0 }));
    expect(result.ok).toBe(false);
    expect(result.data).toEqual(["local"]);
  });

  it("never caches a failure", async () => {
    const cache = createHostedCache({ now: clock().now, ttlMs: 1_000_000 });
    const calls = { count: 0 };
    const key = publicKey("city-circles", "all");

    await cache.read(key, [], failLoader<string[]>(calls));
    await cache.read(key, [], failLoader<string[]>(calls));

    expect(calls.count).toBe(2);
    expect(cache.size).toBe(0);
  });

  it("does not throw when the loader rejects", async () => {
    const cache = createHostedCache({ now: clock().now });
    const result = await cache.read(publicKey("feed", "recent"), ["local"], async () => {
      throw new Error("kaboom");
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.data).toEqual(["local"]);
    expect(result.message).toBe("kaboom");
  });

  it("does not throw when an uncached loader rejects", async () => {
    const cache = createHostedCache({ now: clock().now });
    const result = await cache.read(ownerKey(null, "garage"), ["local"], async () => {
      throw new Error("kaboom");
    });
    expect(result.ok).toBe(false);
    expect(result.data).toEqual(["local"]);
  });
});

/* -------------------------------------------------------------------------- */
/* Invalidation                                                               */
/* -------------------------------------------------------------------------- */

describe("invalidation", () => {
  it("drops one namespace without touching the others", async () => {
    const cache = createHostedCache({ now: clock().now, ttlMs: 1_000_000 });
    const noop = { count: 0 };
    const cities = publicKey("city-circles", "all");
    const playbooks = publicKey("playbooks", "all");

    await cache.read(cities, [], okLoader(["c"], noop));
    await cache.read(playbooks, [], okLoader(["p"], noop));
    cache.invalidateNamespace("city-circles");

    expect(cache.peek(cities)).toBeNull();
    expect(cache.peek(playbooks)).toEqual(["p"]);
  });

  it("drops one user's entries on sign-out and leaves public data alone", async () => {
    const cache = createHostedCache({ now: clock().now, ttlMs: 1_000_000 });
    const noop = { count: 0 };
    const mine = ownerKey("user-a", "garage");
    const theirs = ownerKey("user-b", "garage");
    const shared = publicKey("city-circles", "all");

    await cache.read(mine, [], okLoader(["a"], noop));
    await cache.read(theirs, [], okLoader(["b"], noop));
    await cache.read(shared, [], okLoader(["c"], noop));
    cache.invalidateUser("user-a");

    expect(cache.peek(mine)).toBeNull();
    expect(cache.peek(theirs)).toEqual(["b"]);
    expect(cache.peek(shared)).toEqual(["c"]);
  });

  it("ignores an empty user id rather than clearing the world", async () => {
    const cache = createHostedCache({ now: clock().now, ttlMs: 1_000_000 });
    const shared = publicKey("city-circles", "all");
    await cache.read(shared, [], okLoader(["c"], { count: 0 }));
    cache.invalidateUser("  ");
    expect(cache.peek(shared)).toEqual(["c"]);
  });

  it("clear() empties everything", async () => {
    const cache = createHostedCache({ now: clock().now, ttlMs: 1_000_000 });
    await cache.read(publicKey("feed", "recent"), [], okLoader(["v"], { count: 0 }));
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Shared instance and configuration                                          */
/* -------------------------------------------------------------------------- */

describe("shared instance", () => {
  it("reads through the module singleton and can be cleared", async () => {
    clearHostedCache();
    const calls = { count: 0 };
    const key = publicKey("test-namespace", "shared");

    const first = await readThroughCache(key, [], okLoader(["v"], calls), { staleMs: 0, ttlMs: 60_000 });
    const second = await readThroughCache(key, [], okLoader(["v"], calls), { staleMs: 0, ttlMs: 60_000 });

    expect(first.data).toEqual(["v"]);
    expect(second.data).toEqual(["v"]);
    expect(calls.count).toBe(1);
    expect(hostedCache.peek(key)).toEqual(["v"]);

    clearHostedCache();
    expect(hostedCache.peek(key)).toBeNull();
  });

  it("peek is null for a key that was never fetched", () => {
    clearHostedCache();
    expect(hostedCache.peek(publicKey("test-namespace", "missing"))).toBeNull();
    expect(hostedCache.peek(null)).toBeNull();
  });
});

describe("ttl table", () => {
  it("keeps fast-moving data fresher than curated reference data", () => {
    expect(CACHE_TTL.feedPage.ttlMs).toBeLessThan(CACHE_TTL.cityCircles.ttlMs);
    expect(CACHE_TTL.postQuality.ttlMs).toBeLessThan(CACHE_TTL.playbooks.ttlMs);
  });

  it("always leaves a stale window, so a failed refresh has something to serve", () => {
    for (const entry of Object.values(CACHE_TTL)) {
      expect(entry.staleMs).toBeGreaterThan(0);
      expect(entry.ttlMs).toBeGreaterThan(0);
    }
  });

  it("rejects nonsense configuration instead of caching forever", async () => {
    const cache = createHostedCache({ maxEntries: Number.NaN, staleMs: -1, ttlMs: Number.NaN });
    const calls = { count: 0 };
    await cache.read(publicKey("feed", "recent"), [], okLoader(["v"], calls));
    expect(cache.size).toBe(1);
  });
});
