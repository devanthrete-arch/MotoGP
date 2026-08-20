# Autoflex incident runbook

Symptom -> first check -> likely cause -> action, for the failures this system
can actually have. Architecture, thresholds and the deployment process are in
[DEPLOYMENT.md](./DEPLOYMENT.md).

**The first five minutes, always:**

1. **Stop the bleeding before diagnosing.** If users are affected and a deploy
   went out in the last hour, roll back first (section R) and investigate the
   rolled-back build afterwards.
2. Note the time, the symptom, and the last production commit SHA in the team
   channel. Someone else may already be working on it.
3. Run the probe - it names the broken layer in about ten seconds:
   ```bash
   node scripts/smoke-production.mjs
   ```
4. Do not apply a migration during an incident unless the migration *is* the
   fix, and even then, dry-run it first.

Severity:

| Sev | Meaning | Examples |
| --- | --- | --- |
| **1** | Users cannot use the app, or data is being lost or exposed | site down, every route 404s, writes failing, RLS regression |
| **2** | A major journey is broken, workarounds exist | feed will not load, link previews dead, stale shell for returning users |
| **3** | Degraded or cosmetic | slow feed, one route slow, warn-level thresholds |

---

## A. Production returns 404 on real routes (`/community`, `/cars/<slug>`)

**Symptom.** `https://moto-gp-chi.vercel.app/` loads fine, but shared links,
deep links and refreshes on any sub-route return Vercel's 404 page. Sev 1 -
every link anyone has ever shared is dead.

**First check.**
```bash
curl -sI https://moto-gp-chi.vercel.app/community | head -1
curl -sI https://moto-gp-chi.vercel.app/cars/tata-nexon | head -1
curl -sI https://moto-gp-chi.vercel.app/ | head -1
node scripts/smoke-production.mjs   # "deep links serve the app shell" will fail
```
If `/` is 200 and sub-routes are 404, this is routing configuration, not an
outage.

**Likely cause.**
1. The SPA fallback rewrite in `vercel.json` was changed, reordered, or its
   negative-lookahead pattern was edited. The fallback
   `{"source": "/((?!assets/|.*\\..*).*)", "destination": "/index.html"}`
   **must remain the last entry** in `rewrites` - Vercel takes the first match,
   so anything after it is unreachable and anything before it can shadow it.
2. The crawler rewrite above it started matching normal browsers (its
   `has.value` user-agent regex was widened), sending humans to `/api/og`.
3. `outputDirectory` no longer matches what the build produces, so `index.html`
   is not where Vercel looks.

**Action.**
1. Roll back (section R). This is entirely a config regression; the previous
   deployment is known good.
2. Reproduce locally against the built output before re-deploying:
   ```bash
   npm run build
   npx vercel dev            # honours vercel.json rewrites
   curl -sI localhost:3000/community | head -1
   ```
3. Fix, then confirm with `node scripts/smoke-production.mjs --url=...` before
   merging. The smoke test covers `/community`, `/garage`, `/shortlist`,
   `/vault`, `/profile/settings` and `/cars/:slug` precisely because this
   failure is invisible from `/`.

---

## B. Supabase unreachable or erroring

**Symptom.** The app loads and looks healthy but nothing syncs: the feed shows
only seeded/local content, new posts and garage entries do not appear on another
device, and there is no error banner - `src/hosted/result.ts` degrades every
hosted call to local data on purpose. Sev 1 if writes are being lost.

**First check.**
```bash
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' https://uxzdmlqyxausmmdpmkrr.supabase.co/rest/v1/
```
Then the Supabase dashboard: project status, API report (4xx/5xx rate), database
health (CPU, connections, disk). Check https://status.supabase.com. In the
browser console, a failing hosted call returns
`{ ok: false, reason: "request-failed" }` - as opposed to `offline`,
`signed-out` or `unconfigured`, which are normal and not an incident.

**Likely cause.**
| What you see | Cause |
| --- | --- |
| Project shows *paused* | free-tier inactivity pause, or a billing failure. Restore from the dashboard |
| 5xx from PostgREST, high CPU | query load or a bad plan saturating the instance |
| Writes fail, reads succeed | connection or pool exhaustion - the classic version of this failure, and it hides itself because cached reads keep working |
| 401/403 on everything | the publishable key was rotated without redeploying, or an RLS policy changed |
| Disk near full | Postgres throttles and can go read-only |
| Reachable from your machine, not from users | regional network issue between users and `ap-south-1`; confirm from a second network before acting |

**Action.**
1. If paused -> restore. If billing -> fix billing. Both are dashboard actions.
2. If saturated: find the offending query in the dashboard's query performance
   view. Kill a runaway statement with
   `select pg_terminate_backend(pid) from pg_stat_activity where state = 'active' and now() - query_start > interval '30 seconds';`
   (verify what you are killing first).
3. If connections are exhausted: check what is holding them -
   `select count(*), application_name, state from pg_stat_activity group by 2,3 order by 1 desc;`
   Browsers do not hold Postgres connections (they speak HTTP to PostgREST), so
   the holder is PostgREST's pool, a leftover migration session, or a script.
   Terminate idle-in-transaction sessions, then look at the compute tier
   (DEPLOYMENT.md 9.2).
4. Communicate. Because the app fails silently to local data, users will not
   report it - post in-channel so nobody ships on top of a degraded database.
5. Afterwards: the app already degrades gracefully; the gap is that **nothing
   alerts on it**. This is what the `request-failed` threshold in DEPLOYMENT.md
   8.4 exists for.

---

## C. Users stuck on a stale shell (service worker)

**Symptom.** A deploy went out and succeeded, the fix is live for anyone in a
private window, but returning users still see the old UI - sometimes for days.
Sev 2, or Sev 1 if the stale build is the broken one you just rolled back from.

**First check.**
```bash
curl -sI https://moto-gp-chi.vercel.app/sw.js | grep -i cache-control
curl -s  https://moto-gp-chi.vercel.app/sw.js | head -3   # CACHE_NAME hash
```
Compare that `autoflex-<hash>` with what an affected browser reports in
DevTools -> Application -> Service Workers / Cache Storage. In DevTools, look at
whether the new worker is "waiting" or whether its `install` **failed**.

**Likely cause.**
1. `/sw.js` is being served with a long-lived or `immutable` cache header, so
   the browser never re-fetches the update mechanism itself. `vercel.json` now
   pins it to `public, max-age=0, must-revalidate`; if that header is missing,
   this is your cause.
2. **`install` is failing.** `scripts/build-service-worker.mjs` precaches the
   entire `dist` listing in one `cache.addAll()`, which is all-or-nothing: one
   404 among ~64 URLs rejects the whole install, the new worker never activates,
   and the old one keeps serving forever. A partially propagated deploy or a
   removed asset does this.
3. The build shipped without `dist/sw.js` (the `node scripts/build-service-worker.mjs`
   step in `npm run build` did not run) - the CI build job asserts against this.

**Action.**
1. Verify the deployment actually contains every precached URL: the smoke test's
   "hashed assets referenced by index.html resolve" check covers exactly this.
   If an asset is missing, redeploy - do not try to patch the worker.
2. Fix the `/sw.js` cache header if it regressed, then redeploy. The next
   navigation re-fetches `sw.js`, sees a new `CACHE_NAME`, installs, and the
   `activate` handler deletes every other cache.
3. For an individual stuck user: DevTools -> Application -> Service Workers ->
   Unregister, then hard reload. This does not scale; use it to confirm the
   diagnosis, not as the fix.
4. If a bad shell is cached widely and the worker will not update, the only
   reliable kill switch is a build whose `sw.js` unregisters itself
   (`self.registration.unregister()`), which requires a change to
   `scripts/build-service-worker.mjs`. Treat it as a last resort - it disables
   offline support for everyone until the next release.

---

## D. Migration half-applied

**Symptom.** The `Database migrations` workflow failed in `apply` mode, or a
manual migration errored partway. The schema state is unknown. Sev 1 - assume
the database is inconsistent until proven otherwise.

**First check.**
```bash
export SUPABASE_DB_URL='...'
./scripts/apply-migrations.sh --status
```
That prints what the ledger believes is applied. Then compare with reality:
```sql
select table_name, column_name from information_schema.columns
where table_schema = 'public' and table_name = '<table from the failed file>';
select indexname from pg_indexes where schemaname = 'public' and tablename = '<table>';
```
Read the failed workflow log: the psql error names the statement that failed.

**Likely cause and what it means.**
| Case | State |
| --- | --- |
| The file was transactional (the default) | **Nothing was applied.** psql ran it with `--single-transaction`, so the failure rolled the whole file back and the ledger row was never written. The schema is exactly as it was |
| The file declared `-- migration: no-transaction` | **Partially applied.** Statements before the failure committed; the ledger row was not written |
| The workflow was cancelled or the runner died mid-run | Same as above, plus a possible lock still held by a dead session |
| Two runs raced | The advisory lock or the ledger primary key should have stopped the second one; confirm which run wrote the ledger row |

**Action.**
1. **Do not re-run `--apply` blindly.** For a `no-transaction` file it would
   re-execute statements that already committed.
2. Check for stuck locks and sessions:
   ```sql
   select pid, state, wait_event_type, left(query, 120)
   from pg_stat_activity where state <> 'idle' order by query_start;
   select * from pg_locks where not granted;
   ```
   Terminate a dead migration session with `pg_terminate_backend(pid)`; a
   transaction-scoped advisory lock is released automatically when it goes.
3. Decide forward or back:
   - **Forward (preferred).** Make the remaining statements idempotent
     (`add column if not exists`, `create index if not exists`,
     `drop constraint if exists`) in a **new** migration file and apply that.
     Never edit the failed file - the migration lint rejects edits to merged
     migrations for exactly this reason.
   - **Back.** Only if the partial change breaks the running frontend, and only
     with a compensating migration that restores the previous shape. If data was
     modified, restore is the only correct answer - Supabase daily backup, or
     PITR if the add-on is enabled (it is not today; DEPLOYMENT.md 9.1).
4. Once the schema is verified correct, reconcile the ledger so the runner
   agrees with reality:
   ```sql
   insert into supabase_migrations.schema_migrations (version, name, statements)
   values ('<14-digit version>', '<name>', array['-- reconciled manually after incident'])
   on conflict (version) do nothing;
   ```
5. Confirm the *currently deployed* frontend still works before doing anything
   else - the app is deployed separately and may now be talking to a shape it
   does not expect.
6. Write down what happened in the PR that introduced the migration.

---

## E. Production has stopped tracking `master`

**Symptom.** A merged change is not live. The site is healthy but old.

**First check.** Vercel dashboard -> Deployments: is there a deployment for the
merge commit, and did it succeed? Then Actions -> `Deploy (master)`.

**Likely cause.** A failed Vercel build (a build-time-only failure that local
`npm run build` did not reproduce - most often an env var missing in the Vercel
project, or a case-sensitive import that only breaks on Linux); or
`git.deploymentEnabled` was turned off for `master`; or the Vercel-GitHub
integration lost authorisation.

**Action.**
1. Read the Vercel build log; it names the failing step.
2. Case-sensitivity and missing-env failures reproduce with
   `rm -rf node_modules dist && npm ci && npm run build` on Linux.
3. If the integration is disconnected, reconnect it in project settings, then
   redeploy the latest `master` commit from the dashboard.
4. Confirm with `node scripts/smoke-production.mjs`.

---

## F. Feed is slow

**Symptom.** The community feed takes seconds to load; the rest of the app is
fine. Sev 3, Sev 2 if it times out.

**First check.** Supabase dashboard -> Query performance, and the smoke test's
feed-latency check (`SMOKE_SUPABASE_KEY` must be set for it to run). Compare
against the p95 budget of 800 ms in DEPLOYMENT.md 8.4.

**Likely cause.** The keyset pagination in `listHostedPostsPage` stopped
matching its index (a change to the `order`/cursor `or(...)` predicate, or a new
filter); the indexes from `20260819200000_add_post_comment_count_and_feed_indexes.sql`
are missing on this database; or instance CPU is saturated by something else.

**Action.**
1. `explain analyze` the equivalent query and confirm an index scan, not a
   sequential scan.
2. Confirm the indexes exist:
   `select indexname from pg_indexes where tablename = 'owner_posts';`
3. If the plan is fine and CPU is the limit, that is a compute tier
   conversation (DEPLOYMENT.md 9.2), not a query fix.

---

## G. Link previews are broken

**Symptom.** Links shared to WhatsApp/Slack/X show no card, or show the wrong
one. Sev 3.

**First check.**
```bash
curl -s -A 'facebookexternalhit/1.1' https://moto-gp-chi.vercel.app/community | grep -c 'og:title'
curl -s -A 'facebookexternalhit/1.1' https://moto-gp-chi.vercel.app/cars/tata-nexon | head -20
```

**Likely cause.** The crawler `rewrites` rule in `vercel.json` was changed;
`api/og.js` is erroring (it calls Supabase REST, so a Supabase incident breaks
it too); `OG_ALLOWED_HOSTS`/`VITE_PUBLIC_ORIGIN` do not include the host being
requested, so the origin resolver rejects it; or the crawler cached an old
response (they cache aggressively - re-scrape from the platform's debugger).

**Action.** Check Vercel function logs for `api/og.js` first - it is the only
server-side code in the request path and the only place a 5xx can originate.
Note that the function runs in `iad1` while Supabase is in `ap-south-1`, so it
is also the slowest thing in the system (DEPLOYMENT.md 9.2).

---

## H. Suspected data exposure (RLS regression)

**Symptom.** A user reports seeing someone else's garage, documents or drafts.
Sev 1, always, and it is a privacy incident, not just a bug.

**First check.** Reproduce with two accounts. Then, for the affected table:
```sql
select relname, relrowsecurity from pg_class where relname = '<table>';
select policyname, cmd, qual, with_check from pg_policies where tablename = '<table>';
```
Every user-scoped table must have `relrowsecurity = true` and policies keyed on
`(select auth.uid()) = user_id`. Only `owner_posts`, `post_comments`,
`city_circles` and `model_playbooks` are intentionally anon-readable.

**Action.**
1. If a policy is missing or too broad, restore it immediately with a migration
   (this is the one case where speed beats the normal process - but still write
   it as a migration file so the fix is durable).
2. Determine the exposure window from the migration history, and what was
   readable.
3. Do **not** put user data or identifiers into the incident notes; reference
   row counts and table names only.
4. Reminder: vault documents never leave the device (`src/screens/DocVault.tsx`
   keeps them in `localStorage`), so they cannot be exposed by an RLS bug. Say
   so explicitly when assessing scope.

---

## R. Rollback quick reference

```bash
# 1. Identify the last known-good production deployment
vercel ls moto-gp --scope <team>

# 2. Roll back - re-points the alias, no rebuild, takes seconds
vercel rollback <deployment-url-or-id> --scope <team> --yes
#    or: Vercel dashboard -> moto-gp -> Deployments -> ... -> Instant Rollback

# 3. Verify
node scripts/smoke-production.mjs

# 4. Revert the commit on master so the next deploy does not roll forward
#    into the same failure
git revert <sha> && git push origin master
```

**Before rolling back, ask whether a migration shipped with it.** A rollback
restores code, never schema:

- expand-only or backfill migration -> rollback is safe, leave the migration
  applied;
- contract migration (a column was dropped/renamed/retyped) -> **rollback is
  not safe**, the old build needs what is gone; roll forward instead, or apply a
  compensating migration that re-adds the column as nullable first.

Full decision table: DEPLOYMENT.md section 9.1.

---

## Useful commands

```bash
# Deployment probe (all real journeys)
node scripts/smoke-production.mjs
node scripts/smoke-production.mjs --url=https://<preview>.vercel.app

# Migration state
./scripts/apply-migrations.sh --status
./scripts/apply-migrations.sh --dry-run
node scripts/check-migrations.mjs

# Headers and cache posture
curl -sI https://moto-gp-chi.vercel.app/            | sed -n '1p;/[Cc]ache-[Cc]ontrol/p;/[Cc]ontent-[Ss]ecurity/p'
curl -sI https://moto-gp-chi.vercel.app/sw.js       | sed -n '1p;/[Cc]ache-[Cc]ontrol/p'

# API container (if deployed)
docker logs <container> | tail -50 | jq -c 'select(.level != "info")'
curl -s localhost:3001/health
```
