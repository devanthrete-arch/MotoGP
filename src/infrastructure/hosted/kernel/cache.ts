import type { HostedResult } from "./result";

/**
 * A tiny, dependency-free read-through cache for the hosted layer.
 *
 * It exists to solve four concrete problems on a cold feed load:
 *
 * 1. **Stampede.** Ten components asking for the same city list at mount used
 *    to be ten PostgREST round trips. In-flight requests are now deduplicated,
 *    so concurrent callers share one promise.
 * 2. **Repeat cost.** Reference data (city circles, model playbooks, post
 *    quality) changes on the order of minutes but was re-fetched on every
 *    navigation. Entries now carry a TTL.
 * 3. **Jank on a flaky Indian mobile network.** Past the TTL an entry is served
 *    immediately and refreshed in the background (stale-while-revalidate), and
 *    a failed refresh keeps the last good value instead of blanking the screen.
 * 4. **Memory on low-end Android.** The cache is bounded and evicts
 *    least-recently-used entries, so it can never grow without limit.
 *
 * ## The two invariants that matter
 *
 * - **It never throws and never blocks a render.** Every entry point catches;
 *   loaders already return a non-throwing {@link HostedResult}. A cache fault
 *   degrades to "call the loader", never to an exception in a component.
 * - **It cannot serve one user's rows to another.** Keys are a branded type
 *   that only {@link publicKey} and {@link ownerKey} can mint. `publicKey` is
 *   for anon-readable tables only (`city_circles`, `model_playbooks`,
 *   `playbook_entries`, `owner_posts`, `post_comments`,
 *   `post_quality_scores`); everything else is behind RLS and needs
 *   `ownerKey(userId, ...)`, which returns `null` — bypassing the cache
 *   entirely — when there is no user id to scope by.
 */

declare const cacheKeyBrand: unique symbol;

/** Opaque cache key. Mint one with {@link publicKey} or {@link ownerKey}. */
export type CacheKey = string & { readonly [cacheKeyBrand]: "hosted-cache-key" };

export type CachePart = string | number | boolean | null | undefined;

export type HostedCacheOptions = {
  /** How long an entry is served without any network call. */
  ttlMs?: number;
  /** Window after the TTL in which the entry is served *and* refreshed. */
  staleMs?: number;
  /** Hard cap on entries; the least recently used is evicted past it. */
  maxEntries?: number;
  /** Injectable clock, so tests do not sleep. */
  now?: () => number;
};

export type ReadOptions = {
  ttlMs?: number;
  staleMs?: number;
  /** Force a network read and replace the entry (pull to refresh). */
  forceRefresh?: boolean;
};

export type HostedCacheStats = {
  entries: number;
  hits: number;
  staleHits: number;
  misses: number;
  dedupes: number;
  evictions: number;
  revalidations: number;
  failedRevalidations: number;
};

/** 2 minutes fresh, 10 more minutes stale-but-servable, 64 entries. */
export const DEFAULT_TTL_MS = 120_000;
export const DEFAULT_STALE_MS = 600_000;
export const DEFAULT_MAX_ENTRIES = 64;

/* -------------------------------------------------------------------------- */
/* Keys                                                                       */
/* -------------------------------------------------------------------------- */

const encodePart = (part: CachePart): string => {
  if (part === null || part === undefined) return "";
  try {
    return encodeURIComponent(String(part));
  } catch {
    return "";
  }
};

const joinParts = (parts: readonly CachePart[]): string => parts.map(encodePart).join("|");

/**
 * Key for data any anonymous visitor may read. Only use this for tables whose
 * RLS grants `select` to the `anon` role.
 */
export const publicKey = (namespace: string, ...parts: readonly CachePart[]): CacheKey =>
  `public:${encodePart(namespace)}:${joinParts(parts)}` as CacheKey;

/**
 * Key for owner-scoped data, namespaced by user id so a cached row can never
 * outlive the session that fetched it. Returns `null` when there is no user —
 * callers pass that straight to {@link readThroughCache}, which then skips the
 * cache instead of falling back to a shared key.
 */
export const ownerKey = (
  userId: string | null | undefined,
  namespace: string,
  ...parts: readonly CachePart[]
): CacheKey | null => {
  if (typeof userId !== "string") return null;
  const id = userId.trim();
  if (!id) return null;
  return `owner:${encodePart(id)}:${encodePart(namespace)}:${joinParts(parts)}` as CacheKey;
};

/** True when the key is owner-scoped; used by {@link HostedCache.invalidateUser}. */
const ownerPrefixFor = (userId: string): string => `owner:${encodePart(userId.trim())}:`;

/* -------------------------------------------------------------------------- */
/* Cache                                                                      */
/* -------------------------------------------------------------------------- */

type Entry<Value> = {
  value: Value;
  storedAt: number;
};

type Freshness = "fresh" | "stale" | "expired";

const positive = (value: number | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;

export class HostedCache {
  /** Insertion order doubles as LRU order: oldest first, most recent last. */
  private readonly entries = new Map<string, Entry<unknown>>();

  private readonly inflight = new Map<string, Promise<HostedResult<unknown>>>();

  private readonly ttlMs: number;

  private readonly staleMs: number;

  private readonly maxEntries: number;

  private readonly now: () => number;

  private stats: HostedCacheStats = {
    dedupes: 0,
    entries: 0,
    evictions: 0,
    failedRevalidations: 0,
    hits: 0,
    misses: 0,
    revalidations: 0,
    staleHits: 0,
  };

  constructor(options: HostedCacheOptions = {}) {
    this.ttlMs = positive(options.ttlMs, DEFAULT_TTL_MS);
    this.staleMs = positive(options.staleMs, DEFAULT_STALE_MS);
    this.maxEntries = Math.max(1, Math.floor(positive(options.maxEntries, DEFAULT_MAX_ENTRIES)));
    this.now = typeof options.now === "function" ? options.now : () => Date.now();
  }

  /* ---------------------------------------------------------------------- */
  /* Introspection                                                          */
  /* ---------------------------------------------------------------------- */

  get size(): number {
    return this.entries.size;
  }

  /** Snapshot of counters. Cheap enough to log on a debug screen. */
  snapshot(): HostedCacheStats {
    return { ...this.stats, entries: this.entries.size };
  }

  /**
   * Synchronous look-up for an optimistic first paint. Returns the last good
   * value whatever its age, or `null`. Never triggers a fetch.
   */
  peek<Value>(key: CacheKey | null): Value | null {
    if (!key) return null;
    try {
      const entry = this.entries.get(key);
      return entry ? (entry.value as Value) : null;
    } catch {
      return null;
    }
  }

  /** Keys currently held, oldest (next to be evicted) first. Test seam. */
  keys(): string[] {
    return [...this.entries.keys()];
  }

  /* ---------------------------------------------------------------------- */
  /* Invalidation                                                           */
  /* ---------------------------------------------------------------------- */

  delete(key: CacheKey | null): void {
    if (!key) return;
    this.entries.delete(key);
  }

  /** Drops every entry whose key starts with `prefix` (namespace or user). */
  invalidatePrefix(prefix: string): void {
    if (!prefix) return;
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  /** Call on sign-out: no owner-scoped entry survives a session change. */
  invalidateUser(userId: string | null | undefined): void {
    if (typeof userId !== "string" || !userId.trim()) return;
    this.invalidatePrefix(ownerPrefixFor(userId));
  }

  invalidateNamespace(namespace: string): void {
    this.invalidatePrefix(`public:${encodePart(namespace)}:`);
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }

  /* ---------------------------------------------------------------------- */
  /* Read-through                                                           */
  /* ---------------------------------------------------------------------- */

  /**
   * Serve `key` from cache when possible, otherwise from `load`.
   *
   * - **fresh** — returns the cached value with no network call.
   * - **stale** — returns the cached value *now* and refreshes in the
   *   background; a failed refresh is swallowed and the value stays.
   * - **expired or missing** — awaits `load`, deduplicated per key.
   *
   * Only the success arm is ever stored: a failure means "the network could not
   * answer", which is a fact about this moment, not a value worth keeping.
   * On failure the caller gets the failure arm back with `data` set to the last
   * good cached value if there is one, and to `fallback` if there is not — so
   * `result.data` is always usable, exactly as the rest of the hosted layer
   * promises.
   *
   * Passing `key: null` (an unscoped owner read) bypasses the cache entirely.
   */
  async read<Value>(
    key: CacheKey | null,
    fallback: Value,
    load: () => Promise<HostedResult<Value>>,
    options: ReadOptions = {},
  ): Promise<HostedResult<Value>> {
    if (!key) return this.runUncached(fallback, load);

    let entry: Entry<Value> | undefined;
    let freshness: Freshness = "expired";
    try {
      entry = this.touch<Value>(key);
      freshness = entry ? this.freshnessOf(entry, options) : "expired";
      if (options.forceRefresh) freshness = "expired";

      if (entry && freshness === "fresh") {
        this.stats.hits += 1;
        return { data: entry.value, ok: true, source: "hosted" };
      }

      if (entry && freshness === "stale") {
        this.stats.staleHits += 1;
        // Fire and forget: a background refresh must not make the caller wait,
        // and must not surface a rejection anywhere.
        void this.revalidate(key, load);
        return { data: entry.value, ok: true, source: "hosted" };
      }

      this.stats.misses += 1;
    } catch {
      // A broken cache is not a broken read.
      return this.runUncached(fallback, load);
    }

    const result = await this.dedupe(key, load);
    if (result.ok) return result;
    // Failure arm: prefer the last good server value, else the caller's local one.
    const lastGood = entry ? entry.value : this.peek<Value>(key);
    return { ...result, data: lastGood === null || lastGood === undefined ? fallback : lastGood };
  }

  /* ---------------------------------------------------------------------- */
  /* Internals                                                              */
  /* ---------------------------------------------------------------------- */

  private async runUncached<Value>(
    fallback: Value,
    load: () => Promise<HostedResult<Value>>,
  ): Promise<HostedResult<Value>> {
    try {
      return await load();
    } catch (error) {
      return {
        data: fallback,
        message: error instanceof Error && error.message ? error.message : "The hosted request failed.",
        ok: false,
        reason: "unexpected",
        source: "local",
      };
    }
  }

  /** Look up and promote to most-recently-used in one step. */
  private touch<Value>(key: CacheKey): Entry<Value> | undefined {
    const entry = this.entries.get(key) as Entry<Value> | undefined;
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry as Entry<unknown>);
    return entry;
  }

  private freshnessOf(entry: Entry<unknown>, options: ReadOptions): Freshness {
    const ttl = positive(options.ttlMs, this.ttlMs);
    const stale = positive(options.staleMs, this.staleMs);
    const age = this.now() - entry.storedAt;
    if (age < 0) return "fresh"; // clock went backwards; do not thrash the network
    if (age <= ttl) return "fresh";
    if (age <= ttl + stale) return "stale";
    return "expired";
  }

  private store<Value>(key: CacheKey, value: Value): void {
    this.entries.delete(key);
    this.entries.set(key, { storedAt: this.now(), value });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
      this.stats.evictions += 1;
    }
  }

  /**
   * One network call per key at a time. Later callers await the promise the
   * first one created; this is the stampede fix that matters on a cold feed.
   */
  private dedupe<Value>(key: CacheKey, load: () => Promise<HostedResult<Value>>): Promise<HostedResult<Value>> {
    const existing = this.inflight.get(key) as Promise<HostedResult<Value>> | undefined;
    if (existing) {
      this.stats.dedupes += 1;
      return existing;
    }

    const pending = (async (): Promise<HostedResult<Value>> => {
      try {
        const result = await load();
        if (result.ok) this.store(key, result.data);
        return result;
      } catch (error) {
        return {
          data: undefined as unknown as Value,
          message: error instanceof Error && error.message ? error.message : "The hosted request failed.",
          ok: false,
          reason: "unexpected",
          source: "local",
        };
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, pending as Promise<HostedResult<unknown>>);
    return pending;
  }

  /** Background refresh for a stale entry. Swallows everything by design. */
  private async revalidate<Value>(key: CacheKey, load: () => Promise<HostedResult<Value>>): Promise<void> {
    if (this.inflight.has(key)) return;
    this.stats.revalidations += 1;
    try {
      const result = await this.dedupe(key, load);
      if (!result.ok) this.stats.failedRevalidations += 1;
    } catch {
      this.stats.failedRevalidations += 1;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Module singleton                                                           */
/* -------------------------------------------------------------------------- */

export const createHostedCache = (options: HostedCacheOptions = {}): HostedCache => new HostedCache(options);

/** The instance the hosted layer reads through. One per tab. */
export const hostedCache = createHostedCache();

/**
 * Convenience wrapper over {@link HostedCache.read} bound to the shared
 * instance. Hosted modules call this; nothing else should need the class.
 */
export const readThroughCache = <Value>(
  key: CacheKey | null,
  fallback: Value,
  load: () => Promise<HostedResult<Value>>,
  options: ReadOptions = {},
): Promise<HostedResult<Value>> => hostedCache.read(key, fallback, load, options);

/** Drop everything. Call on sign-out and from tests. */
export const clearHostedCache = (): void => hostedCache.clear();

/** Drop one user's scoped entries. Call on sign-out before switching accounts. */
export const invalidateHostedUser = (userId: string | null | undefined): void => hostedCache.invalidateUser(userId);

/** Drop one public namespace, e.g. after publishing new city circles. */
export const invalidateHostedNamespace = (namespace: string): void => hostedCache.invalidateNamespace(namespace);

/**
 * TTLs, in one place so the trade-offs are reviewable.
 *
 * Reference data (cities, playbooks) is curated and tolerates minutes of
 * staleness. Feed pages and quality scores move faster, so they get a short
 * fresh window and a long stale window: the reader always sees something
 * instantly, and the refresh lands a frame later.
 */
export const CACHE_TTL = {
  /** Curated city pages: change on a curator's timescale. */
  cityCircles: { staleMs: 1_800_000, ttlMs: 300_000 },
  /** One feed page keyed by sort + cursor. */
  feedPage: { staleMs: 300_000, ttlMs: 30_000 },
  /** Curated model playbooks and their evidence lines. */
  playbooks: { staleMs: 1_800_000, ttlMs: 300_000 },
  /** Ranking signals: recomputed by authors as they post. */
  postQuality: { staleMs: 300_000, ttlMs: 60_000 },
} as const satisfies Record<string, { ttlMs: number; staleMs: number }>;
