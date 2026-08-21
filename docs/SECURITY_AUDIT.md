# AutoFlex security audit

Audited at commit `81a7359`. Findings are evidence-based: every RLS claim below
was checked by querying `pg_policies` and `information_schema`, not inferred
from code comments.

**Scope covered:** RLS policy correctness, PostgREST filter injection, the
crawler Open Graph shim, the Fastify admin API, response headers, and what the
client bundle exposes.
**Not assessed:** Supabase auth email deliverability and magic-link replay
windows, dependency supply chain beyond `npm audit`, and anything requiring a
live authenticated session against production.

---

## Corrected finding

An earlier review reported that `city_circles` and `model_playbooks` were
"writable by any signed-in account", i.e. that one user could rewrite the Pune
page for everyone. **That is wrong, and the record is corrected here.**

```
city_circles   UPDATE  qual/with_check: (SELECT auth.uid()) = curated_by
city_circles   DELETE  qual:             (SELECT auth.uid()) = curated_by
model_playbooks UPDATE qual/with_check: (SELECT auth.uid()) = curated_by
```

Update and delete are already restricted to the curator. The real weakness is
different, and narrower — see S-2.

---

## Findings

### S-1 — Unbounded reads on shared public tables · **Medium** · fixed

`selectCityCircleRows`, `selectPlaybookRows`, `selectPlaybookEntryRows` and
`selectQualityRows` issued `select("*")` with no row cap on anon-readable
tables that grow with the whole product, not with one user.

*Attack scenario:* no authentication needed. An attacker (or ordinary growth)
inflates `model_playbooks`; every visitor then downloads the entire table on
page load. Cheap to trigger, degrades every client, and costs egress on the
defender's account — a practical asymmetric denial-of-service.

*Fix:* `src/infrastructure/hosted/kernel/limits.ts` defines `PUBLIC_LIST_LIMIT` (200),
`OWNER_LIST_LIMIT` (1000) and `CHILD_LIST_LIMIT` (500); the four reads now
apply them. Caps are a safety net, not paging: surfaces that must walk a large
table should use a cursor, as the feed does.

### S-2 — Curator slug squatting on a shared namespace · **Medium** · FIXED

`city_circles.slug` is the primary key and `INSERT` only requires that the row's
`curated_by` equals the inserter. First writer therefore owns a global name
permanently.

*Attack scenario:* an attacker scripts inserts for `mumbai`, `pune`,
`bengaluru` and every other major city with spam content. Because they are the
curator, only they can update or delete those rows. Legitimate curation is
locked out for good, and the content is world-readable.

*Fix:* curated content is now admin-only. `public.app_admins` holds the allowed
accounts; it has RLS on and **no policies at all**, so no API client can read or
write it — only `service_role` manages membership. `public.is_app_admin()` is
`SECURITY DEFINER` so the policy check can consult that table without exposing
its rows, and returns a boolean only. Insert/update/delete on `city_circles` and
`model_playbooks` now require it; reads stay public.

This also closes **S-3**: the admin policies no longer depend on `curated_by`,
so a row with `curated_by IS NULL` is reachable again instead of being
permanently immutable.

Client behaviour is unchanged for everyone else: those writes were already
fire-and-forget with the result discarded, so a denial is silent and the local
view is unaffected. The client now also stops retrying curated writes for the
rest of the session after the first denial.

### S-3 — `curated_by` is nullable · **Low** · resolved by S-2

A row with `curated_by IS NULL` satisfies no `UPDATE` or `DELETE` policy, so it
becomes permanently immutable through the API — an accidental tombstone in a
public table. Add `not null`, or an admin policy that can reach such rows.

### S-4 — Keyset cursor is interpolated into a PostgREST filter · **Low** · mitigated by design

`listHostedPostsPage` builds `.or("created_at.lt.<value>,and(...)")` from cursor
fields. Cursor values are not raw user input: they are produced by
`encodeFeedCursor` from a column value and the row id, and `decodeFeedCursor`
splits on the last `|`. A hostile cursor could still inject filter syntax.

*Residual risk is low because* PostgREST filters cannot escape into SQL — the
worst outcome is a malformed filter (a 400) or a different, still
RLS-constrained result set. RLS remains the authorisation boundary, so no
cross-user read is reachable this way.

*Recommendation:* validate cursor fields before use — id against
`^[A-Za-z0-9_-]{1,64}$`, value against an ISO timestamp or numeric pattern —
and fall back to the first page when validation fails.

### S-5 — Publishable key in the client bundle · **Info** · by design

`VITE_SUPABASE_PUBLISHABLE_KEY` ships to the browser. This is correct for
Supabase: the key identifies the project, and RLS decides access. The
`service_role` key must never appear in the repo, the bundle, or a chat
transcript. Verified absent from the working tree.

---

## Verified safe

- **RLS is enabled on all 23 tables**, and every owner-scoped policy uses
  `(select auth.uid()) = user_id` — the wrapped form, which is both correct and
  the shape Postgres evaluates once per query rather than per row.
- **17 tables are strictly owner-scoped**; the 6 anon-readable ones are exactly
  the community-content tables intended to be public.
- **`sync_owner_post_comment_count()` is no longer callable by `anon` or
  `authenticated`** — `EXECUTE` was revoked. It remains `SECURITY DEFINER`
  because a commenter must increment a counter on another author's row; a
  trigger still fires correctly without the caller holding `EXECUTE`, since
  Postgres checks that privilege at `CREATE TRIGGER` time.
- **Security advisors return zero lints.**
- **Response headers** carry CSP with `script-src 'self'` and no
  `unsafe-inline`, HSTS with preload, `X-Frame-Options: DENY`, COOP/CORP,
  Referrer-Policy and Permissions-Policy.
- **The OG shim** escapes all interpolated values, validates ids against a
  strict pattern, aborts its upstream call after a short timeout, and is
  reachable only by user-agent-gated rewrite.

---

## Recommendations, in priority order

1. ~~Decide the curator model and close S-2~~ — done: admin-only curation.
2. Add cursor field validation (S-4) — cheap, removes a whole class of doubt.
3. Rate limiting on post/comment writes. The publishable key means RLS answers
   *whose* row, never *how many*; a `write_budget` table plus a `before insert`
   trigger is the only enforcement point a browser cannot route around.
4. Make `curated_by` non-nullable (S-3).
5. Retire the full-snapshot `autoflex_user_backups` writes: it stores a
   duplicate of data its own comment concedes is not authoritative, widening the
   blast radius of any future policy mistake.
