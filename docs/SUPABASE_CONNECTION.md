# Supabase connection and schema compatibility assessment

Assessment started: 2026-10-04; updated: 2026-10-06. Target project reference: `uxzdmlqyxausmmdpmkrr`.

**Status: project healthy, Clerk cloud access pending.** The Anthrete Chrome session showed project `Auto-Moto` as Healthy. The live schema visualizer showed `owner_posts.user_id` as UUID and links to `auth.users`, confirming that the existing tables cannot accept Clerk `user_...` identities directly. Authentication > Third-Party Auth showed no configured providers. A new isolated private-workspace migration and client have been prepared and tested against a disposable PostgreSQL database; neither the migration nor a live Clerk request has been applied to this project. The SQL below remains an optional read-only inspection checklist for the rest of the live schema.

## Current integration setup

1. In the Clerk dashboard, use **Connect with Supabase** for the instance behind `VITE_CLERK_PUBLISHABLE_KEY`. The configured instance domain observed locally was `precious-burro-2461.clerk.accounts.dev`; confirm it is the intended production instance before saving. Clerk session tokens must include `role: authenticated`.
2. In this Supabase project, add Clerk in Authentication > Sign In / Providers > Third-Party Auth using that same instance. This is a security-setting change for the account owner to make.
3. Apply `supabase/migrations/202610050001_clerk_private_workspace.sql` through a reviewed production migration. It creates only `otofolks_private_workspaces` and its save RPC, leaving existing UUID-owned tables intact. Test the migration against a disposable database first with `npm test` (the `cloudSchema.test.ts` test uses PGlite).
4. Configure only the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the local and Vercel environments. Never put a secret or service-role key in a `VITE_` variable. The `src/supabase.ts` client obtains a fresh, session-bound Clerk token for each request.
5. After deployment, sign in with two separate Clerk test accounts. Verify each can save and restore its own private workspace, cannot read or overwrite the other account's workspace, and sees no account data after sign-out. The Account screen saves only when the user presses **Save to account**. Shared community publishing and moderation are still separate work.

## Repository evidence

- Current branch: `codex/otofolks-supabase-integration`; inspected HEAD `fa8a2ce771d0a69875d84bae741a759894b8d284`.
- Historical local ref: `motogp/codex/supabase-private-sync`, commit `4a9354a7871aa50cac5e7f361f5b575723cff00e`. This is repository evidence, not proof of the deployed schema.
- Historical migrations: `supabase/migrations/20260731190000_create_autoflex_application.sql` and `supabase/migrations/20260731201000_add_workspace_sync.sql`, read through Git without checking out the branch.
- Historical adapters: `src/communityApi.ts` publishes posts/comments/reports and saves; `src/cloudSync.ts` uses Supabase Auth sessions and email OTP, then calls `sync_autoflex_workspace`.
- Current `src/main.tsx` and `src/App.tsx` use Clerk. `ClerkConnectedApp` passes `user.id` into application state and remounts on account changes. `src/storage.ts` namespaces signed-in browser data with that ID; this is local account separation, not shared persistence.
- Current `src/domain.ts` defines posts with `comments: string[]`, reports without an authenticated owner field, and an expanded shortlist shape. `src/App.tsx` explicitly saves report drafts locally and shows bookings as a preview.
- `server-ts/app.ts` defaults to an in-memory store. Its inspected report/moderation routes do not verify Clerk sessions or moderator authority; they are not a ready authorization bridge to Supabase.
- This branch now wires `src/supabase.ts`, `src/cloudWorkspace.ts`, and the Account panel to a session-bound Clerk token. Unit, disposable PostgreSQL, and browser tests cover the client path; none proves configured live token trust or an applied production migration.

## Identity incompatibility

All eleven historical tables have a `user_id uuid` referencing `auth.users(id)`. Ownership policies compare that column with `auth.uid()`. The workspace RPC declares `current_user_id uuid := auth.uid()` and writes it throughout the transaction.

Clerk user IDs are opaque strings such as `user_example`, not Supabase Auth UUIDs. They cannot be inserted into a UUID column. Casting the UUID column to text in a policy does not fix inserts or the foreign key. Changing only the column type also does not create a corresponding `auth.users` row or repair the RPC. Clerk sign-in does not itself provision Supabase Auth users; the historical Supabase OTP/session flow is a different identity system. A token with a non-UUID subject is incompatible with UUID-based `auth.uid()` ownership logic and can cause UUID conversion errors.

Migrating the historical UUID-owned tables still requires selecting and validating one identity strategy:

1. Use Clerk subjects as text application identities, with an application-owned identity/profile relationship and ownership checks against the verified JWT subject, conceptually `auth.jwt() ->> 'sub'`. Update every affected key, foreign key, policy, RPC, adapter, and deletion rule together. This requires Supabase to trust the intended Clerk issuer first.
2. Keep an application UUID identity with a unique, trusted Clerk-subject mapping. Resolve ownership through that mapping in the backend or policies. A mapping alone does not make `auth.uid()` compatible or satisfy existing `auth.users` foreign keys. Keeping those foreign keys would require an explicitly designed Supabase Auth identity lifecycle as well.

Do not fabricate UUIDs, insert artificial `auth.users` records, link accounts by display name, or automatically merge accounts by email. Existing UUID owners require a verified account-linking/backfill plan with explicit handling of unlinked records. Do not rewrite historical migrations or apply them blindly to the resumed project.

## Data and access inventory

| Surface | Historical schema and behavior | Compatibility work needed |
| --- | --- | --- |
| Shared posts | `owner_posts`: text ID, UUID owner, vehicle/context/body fields, helpful and fixes counters; public reads, author writes | Bind ownership to verified Clerk identity. Define public visibility and moderator removal. Establish seed/local-post import ownership and collision rules; counters have no per-user vote ledger. |
| Shared comments | `post_comments`: generated UUID ID, text post FK, UUID owner, author/message/timestamps; public reads, author writes | Current string-array comments lack stable IDs, owner IDs, and timestamps. Define normalized records and legacy import rules without guessing authors from display strings. |
| Reports | `reports`: text ID, UUID reporter, post FK, title/reason/name, `Open`/`Dismissed`/`Removed` | Reporter-only `FOR ALL` policy currently permits changing one's own status and deleting one's own report. No moderator-wide queue exists in this SQL. Separate report submission from privileged resolution and define audit/retention behavior. |
| Moderator role | No role table, moderator policy, or audit table | Current account UI labels a user Moderator from `publicMetadata.role` or an email helper. A browser label is not authorization. Use protected role records or verified server-controlled claims; prevent self-promotion and test revocation. `profiles.garage_role` is a vehicle-interest role, not an access role. |
| Profile and preferences | `profiles`, `follows`, `subscription_settings`: owner-private | Preserve profile limits and preference defaults; derive owner from authenticated identity. Determine any public profile projection separately. |
| Private garage | `garage_vehicles`, `timeline_entries`: owner-private, text IDs, composite vehicle/owner FK | Preserve cross-owner FK protection, numeric/date validation, and tombstones. Shared seed IDs can collide across accounts because IDs are globally primary keys. Decide account-scoped keys or globally unique IDs. |
| Private shortlist | `shortlist_items`: owner-private, text ID, budget/status/notes | Current status `New` is rejected by the historical constraint (`Researching`, `Test drive`, `Negotiating`, `Rejected`, `Bought`). Current `variant`, `state`, and `priceSource` have no normalized columns. Specify lossless field/status mapping. |
| Saved posts | `saved_posts`: composite owner/post PK, post FK, owner-private | Local/seed saves require a real shared post before insertion. Define unresolved-save handling and idempotent import. |
| Recovery and private sync | `autoflex_user_backups` plus `sync_autoflex_workspace(jsonb)` | Replace UUID identity assumptions, validate payload versions and conflicts, and preserve account isolation. A backup is not publication to shared tables. |
| Bookings | No booking table or RPC in either migration; current UI is a preview | Agree the service-center contract before implementation: booking ID, verified owner, vehicle/center reference, timezone-aware appointment, status transitions, timestamps, idempotency and cancellation rules. Define owner/operator access and slot-conflict handling. No booking capability is established. |

The historical sync RPC normalizes profile, garage, timeline, shortlist, follows, and subscription settings. It also stores the entire backup JSON, which can include posts, reports, saved IDs, feedback, and tester/QA state. It does **not** publish those embedded posts/reports/comments or synchronize saved-post rows. Feedback, inspection outcomes, and tester/QA state need an explicit decision about private backup-only versus normalized storage; neither migration provides dedicated tables for them.

The RPC is invoker-security by default and grants execution to `authenticated`, not `anon`. It marks existing garage/timeline/shortlist rows deleted before upserting the supplied arrays. Missing arrays become empty arrays: a partial payload can therefore tombstone existing data. There is no expected-version concurrency check. Review full-snapshot requirements, stale-device overwrites, idempotency, transaction rollback, and tombstone-aware reads before reuse.

Historical public SELECT policies expose all post/comment rows without a moderation visibility filter. Deleting a post cascades to comments, saved posts, and reports, which may conflict with moderation audit retention. Historical grants also cover all public tables for authenticated users; inspect actual grants and RLS rather than assuming future tables are safe.

`docs/SERVICE_CENTER_INTEGRATION.md` reserves `/api/service-centers/*` for another team and says the status endpoint creates no requests or appointment data. Booking schema work must respect that ownership boundary.

## Deferred read-only database inspection

After authorized dashboard/database access is restored, run metadata inspection against the confirmed target project. These statements inspect structure only; they do not read application rows, backups, auth-user records, or credentials. They were not executed during this task. Metadata visibility depends on the inspecting role, so missing results are not conclusive proof of absence.

```sql
BEGIN READ ONLY;

-- Discover tables and RLS flags, including migration-history table presence.
SELECT schemaname, tablename, rowsecurity
FROM pg_catalog.pg_tables
WHERE schemaname IN ('public', 'auth', 'supabase_migrations')
ORDER BY schemaname, tablename;

-- Identify UUID/text identity columns, defaults, nullability, and JSON fields.
SELECT table_schema, table_name, ordinal_position, column_name,
       data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
   OR (table_schema = 'auth' AND table_name = 'users' AND column_name = 'id')
ORDER BY table_schema, table_name, ordinal_position;

-- Inspect actual ownership and moderator predicates for every operation.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check foreign keys, primary/unique keys, and accepted status values.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       k.conname, k.contype, pg_get_constraintdef(k.oid) AS definition
FROM pg_catalog.pg_constraint k
JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, k.conname;

-- Grants and RLS must both be reviewed.
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
ORDER BY table_name, grantee, privilege_type;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Read the sync implementation; never invoke it during inspection.
SELECT n.nspname, p.proname,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, p.proacl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('sync_autoflex_workspace', 'set_autoflex_updated_at')
  AND p.prokind = 'f';

SELECT event_object_schema, event_object_table, trigger_name,
       event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

ROLLBACK;
```

If the catalog confirms `supabase_migrations.schema_migrations` and its `version` column exist, a separate read-only query may compare recorded migration versions with the two historical filenames:

```sql
SELECT version
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

Matching migration versions alone do not prove unchanged definitions. Compare actual columns, constraints, grants, policies, functions, and triggers. Do not run `sync_autoflex_workspace`, reset commands, DDL, backfills, or migration deployment as part of inspection; a `SELECT` that invokes a mutating RPC is not a read-only assessment.

**Auth integrations cannot be established or verified through these SQL catalogs.** Supabase's configured third-party Clerk trust is control-plane configuration, not evidence obtainable from `pg_tables`, `auth.users`, or `pg_policies`. When dashboard access returns, inspect the project's authentication integration and intended Clerk instance/issuer through the supported dashboard or management interface. Verify signing-key discovery and required token claims using the integration's supported configuration. Do not infer integration from an existing auth schema or a locally decoded JWT. No configuration or token values should be copied into this document.

## Required validation before migration or connection claims

The new private-workspace path has local unit, browser, and disposable PostgreSQL coverage. The live integration checks below remain pending. Production write/access tests require configured test accounts and a reviewed migration, not privileged credentials that bypass RLS.

1. Confirm target project, actual schema, applied migration history, exposed schemas, grants, RLS, functions, and triggers. Inventory existing row counts and orphan/collision risks later under an approved data-access scope. Prepare and verify a recoverable backup before proposing data changes.
2. Verify Clerk integration configuration and a real request through the intended API path. Check issuer, signature, expiry, subject and required role/audience claims; reject wrong-instance, expired, malformed and tampered tokens. Test refresh, sign-out, and account switching. A public project key or successful Clerk login alone is not proof of database access.
3. Use an anonymous client, users A and B, and a moderator. Test through normal client credentials, not a database owner or privileged service client that bypasses RLS. Expect only intended public content anonymously; private rows, reports, writes and sync must be inaccessible.
4. Verify A can create/edit/delete only A's permitted posts/comments, while B can read public content but cannot spoof A's owner ID or modify A's rows. Verify denied updates/deletes leave rows unchanged, including APIs that return an empty result instead of an error. Test validation limits, missing post FKs, duplicate IDs and moderation visibility.
5. Verify A can submit a report and access only the allowed view of A's reports, cannot resolve it or self-promote, and cannot read B's reports. Verify moderators can access the queue and perform audited actions; role removal must revoke that authority. Define retention when reported content is removed.
6. Verify profile, saves, follows, preferences, garage, timeline, shortlist and recovery payloads are isolated in both directions between A and B. Reject attaching a timeline entry to B's vehicle. Test identical seed IDs across accounts, local import provenance, account switching, and cross-device restore without adopting another user's browser data.
7. Rehearse private sync with complete, partial, malformed, duplicate, stale and concurrent snapshots. Require atomic rollback on failure, explicit deletion semantics, tombstone-aware reads and a conflict strategy. Confirm a private backup cannot accidentally publish embedded reports or posts. Verify shortlist status/extra-field round trips without data loss.
8. Resolve booking ownership and schema contract with the service-center team; only then test owner/operator isolation, availability collisions, timezone handling, idempotent submission, allowed transitions and cancellation. A preview image is not a booking implementation.
9. Rehearse the selected identity migration on a disposable copy: preserve existing UUID-owned records, verify approved identity mappings, compare counts and relationships, validate indexes and query behavior, and demonstrate recovery. Review the concrete migration and application adapters before production execution.

Completion requires recorded evidence of Clerk trust, the applied migration, and successful authorized reads/writes with denied cross-account access. Dashboard access and part of the live schema were observed; Clerk trust and live database behavior remain unverified. This document does not declare the project connected.
