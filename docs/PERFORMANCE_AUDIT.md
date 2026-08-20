# AutoFlex performance and architecture audit

Written after reverse-engineering the codebase at commit `4e24036`, with the
fixes landed in `a14e728` and `1b54323`. Every claim below is backed by a
measurement or by a `EXPLAIN` plan, not by inspection alone.

---

## 1. Architecture as found

```
main.tsx ──▶ ErrorBoundary ──▶ AppStateProvider ──▶ AppFrame ──▶ one of ten screens
                                     │
                                     ├── 45 useState, 27 useMemo, 0 useCallback
                                     ├── localStorage (synchronous, per mutation)
                                     └── src/hosted/** ──▶ Supabase Postgres (RLS)
```

**The good parts, which the refactor preserved:**

- **Local-first is a genuine scaling asset.** First paint reads `localStorage`
  synchronously; the network is a background reconciliation. Most reads never
  touch the database at all.
- **`HostedResult` carries usable `data` on both the success and failure arms**
  and nothing in `src/hosted/` throws, so offline, signed-out and unconfigured
  are ordinary states rather than error paths.
- **RLS uses `(select auth.uid()) = user_id`**, the form Postgres evaluates once
  per query instead of once per row.
- **Per-user data is bounded and indexed**; one user's cost is independent of
  everyone else's.

---

## 2. Critical problems found

### P0 — the feed read the entire database on every page load

`src/hosted/community.ts` had **no `.limit()` or `.range()` anywhere**:

```ts
client.from("owner_posts").select("*").order("created_at", …)      // every post
client.from("post_comments").select("*").order("created_at", …)    // every comment
```

`listHostedPosts` called both on every load, `listHostedPostRankings` scanned
the posts table a *second* time for data the first query already had, and
`syncAllHosted` scanned comments a third time.

Payload therefore grew with the size of the database rather than the size of the
screen. At ~10k posts this is already multi-megabyte JSON per visitor; it fails
long before a million users.

### P0 — a keystroke re-rendered the whole screen

`useAutoflexState()` returns a **139-line object literal** passed straight to
`<AppStateContext.Provider value={value}>` with **no memoisation**, so the
context value had a fresh identity on every render. With **45 `useState` hooks —
four of them per-keystroke drafts** (`query`, `draft`, `vehicleDraft`,
`commentDraft`) — and **zero `useCallback`**, typing one character re-rendered
every consumer, and every handler identity changed, so `React.memo` on children
could never bail out.

Cost of typing grew linearly with feed length.

### P1 — write amplification on every mutation

`writeStoredJson` ran `JSON.stringify` over a whole collection synchronously per
mutation, on the main thread. A burst of edits re-serialised the same array N
times.

### P2 — structural issues left documented, not fixed

| Issue | Why it was left |
| --- | --- |
| `appState.tsx` is a 1,581-line hub | Splitting the context is the right fix but touches all ten screens; it needs its own change with screen-by-screen migration |
| No rate limiting on writes | Needs a product decision on limits before implementation |
| Full-snapshot writes to `autoflex_user_backups` | Redundant now that normalised tables are authoritative; removal needs a migration plan for existing rows |
| No observability | Needs an account/vendor choice |
| Doc Vault stores files client-side only | Real uploads need object storage plus a privacy review |

---

## 3. What was fixed, and the evidence

### Keyset pagination, never OFFSET

```sql
create index owner_posts_created_at_id_idx on owner_posts (created_at desc, id desc);
```

`EXPLAIN (ANALYZE, BUFFERS)` on the page query:

```
Limit  (cost=0.14..2.86 rows=30)
  ->  Index Only Scan using owner_posts_created_at_id_idx
        Heap Fetches: 0
        Buffers: shared hit=1
Execution Time: 0.066 ms
```

One buffer, no sort, no heap fetches — cost is O(page), and **constant at any
depth**. `OFFSET` was deliberately rejected because its cost grows linearly with
rows skipped, so deep pages get slower as the table grows.

The cursor is `(ordering value, primary key)`; the key breaks ties so rows can
never be skipped or duplicated when timestamps collide.

### Column projection and comment denormalisation

The feed now selects the ~19 columns it renders instead of `*`, and
`comment_count` is maintained on `owner_posts` by a trigger (backfilled in the
same migration), so cards show counts without fetching a single comment body.
Bodies load per post when the detail pane opens.

The redundant rankings scan is gone: ranking rides along on the page query.

### Coalesced local writes

Writes buffer per key and flush once per frame, keeping the last value, with a
**synchronous flush on `pagehide` and on `visibilitychange → hidden`** — the last
reliable moments before a browser discards a page. Reads go through the buffer,
so a read-after-write is never stale. Measured: 25 writes to one key collapse to
**1** `setItem`, with the last value intact.

### Memoised feed rows

The 92-line inline row became `PostCard`, memoised, taking only primitives and
stable callbacks — `isSelected`/`isSaved` as booleans rather than the
`selectedPost` object and `saved` Set, whose identity changes on every unrelated
update. The four handlers it uses are now `useCallback`s keyed to the data they
actually read, so a draft change no longer changes their identity.

Proven by test rather than asserted: **three parent re-renders produce zero
additional card renders**, measured with a getter on the prop the component body
reads. Companion tests assert the card *does* re-render when its own post,
saved or selected state changes, so the memo cannot silently over-bail.

### Guard rails

Tests now fail if anyone reintroduces `select("*")` on the two community tables,
an unbounded read, `OFFSET` pagination, a comment scan during sync, or a storage
scheduler that drops a value or skips its pagehide flush.

---

## 4. Results

| | Before | After |
| --- | --- | --- |
| Feed rows per load | entire table | 30, cursor-paged |
| Comment rows per load | entire table | 0 (counts only; bodies on open) |
| Table scans per feed load | 3 | 1 |
| Feed query plan | seq scan + sort | Index Only Scan, 1 buffer, 0 heap fetches |
| `setItem` calls per 25-write burst | 25 | 1 |
| Card renders per 3 keystrokes | 3 × list length | 0 |
| Tests | 245 | 261 |
| Bundle (`index`, gzip) | 143.90 kB | 144.31 kB |

The 0.4 kB bundle increase is the pagination and scheduler logic. It buys an
unbounded reduction in transfer, so it is a good trade.

---

## 5. Recommended next steps, in order

1. **Split the app context** into actions / data / drafts, and migrate screens
   off the compatibility `useApp()`. The `PostCard` work fixes the largest list;
   the same cascade still affects the Garage, Compare and Account screens.
2. **Virtualise long lists** once pagination feeds them (`react-window` or a
   hand-rolled windowing hook) so DOM node count stops tracking result count.
3. **Rate limiting and abuse controls** on post/comment writes.
4. **Retire the full-snapshot backup writes** now that normalised tables are
   authoritative.
5. **Connection pooling and read replicas** (Supavisor) before real traffic.
6. **Observability**: error tracking, slow-query logging, a dashboard owner.
7. **Object storage plus scanning** before Doc Vault accepts real documents.
