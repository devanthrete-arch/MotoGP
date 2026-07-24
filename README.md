# Autoflex

Autoflex is a web-first MVP for an ownership-focused auto community built around
deep owner details, reviews, help articles, and useful discussions.
The current active MVP path is a TypeScript webapp designed for Vercel-first
iteration. The Kotlin/Ktor and Android work remains in the repo as the later
backend/mobile conversion path.

## Project brief

Autoflex is being built as a new-age, ownership-first automotive community:
less like a thin social feed, more like a living garage notebook where car
owners share real reviews, known issues, fixes, costs, travelogues, and buying
advice. The first launch target is a webapp MVP. Android follows after the web
community loop proves useful.

Service-center integration is intentionally kept separate under
`/api/service-centers/*` because another team owns that workstream.

## Current build status

### Done so far

- [x] Pivoted the active MVP back to a TypeScript webapp for fast Vercel/web launch.
- [x] Preserved the Kotlin/Ktor backend and Android folders for the later conversion path.
- [x] Added a Vite/React/TypeScript webapp at the repo root.
- [x] Added local-first MVP data for owner posts, saved notes, model notebooks, and feedback.
- [x] Added the build-loop surface: Product owner → Designer → Backend engineer → Frontend engineer → Tested / QA → Real user.
- [x] Added followed models/topics and a following feed for return-user behavior.
- [x] Added return-user nudges based on follows, saved notes, and garage mileage.
- [x] Added a first-run starter route so testers know the first useful actions to take.
- [x] Added a local-first garage with vehicles and ownership timeline entries.
- [x] Added garage reminders for upcoming service, insurance, and tyre checks.
- [x] Added garage running-cost ledger with spend totals, cost/km, and latest timeline event.
- [x] Added a visible QA smoke-check panel for the current MVP slice.
- [x] Added local subscription preferences and notification previews for followed models/topics.
- [x] Added garage insights for service checkpoints, logged spend, and matching community context.
- [x] Added automated Vitest coverage for feed filtering, follows, nudges, notifications, and garage insights.
- [x] Added lightweight local profile for comments, reports, and future account mapping.
- [x] Added post comments and report submission from the post detail view.
- [x] Added a local moderator queue with dismiss and remove-post actions.
- [x] Added share/copy actions for posts and model notebooks.
- [x] Added garage markdown export using native share with clipboard fallback.
- [x] Added buyer shortlist with model comparison against available owner notes.
- [x] Added buyer inspection checklists generated from shortlist models and owner-note evidence.
- [x] Added local city circles grouping owner notes and garage vehicles by city.
- [x] Added ownership playbooks that convert model notes into owner signals and buyer checks.
- [x] Added post detail quality meter to nudge variant, city, odometer, cost, and outcome context.
- [x] Added responsive layout polish for phone, tablet, and desktop use.
- [x] Hardened local browser storage reads/writes so blocked or corrupt storage does not crash the app.
- [x] Added app-level crash recovery UI to avoid a blank page on render errors.
- [x] Added shared Kotlin request/response models.
- [x] Added native Android project scaffolding for the later Android app path.
- [x] Added community feed with latest/popular sorting, search, brand/topic filters, and pagination.
- [x] Added post detail pages with views, likes, comments, and discussion forms.
- [x] Added create, edit, and delete post flows.
- [x] Added lightweight recoverable profiles with recovery codes.
- [x] Added saved posts tied to browser/profile tokens.
- [x] Added structured ownership fields: brand, model, variant, city, and odometer.
- [x] Added knowledge labels: owner note, review, known issue, fix, cost note, and travelogue.
- [x] Added Models hub and model notebooks grouping ownership knowledge by car.
- [x] Added verified-fix flow: "Worked for me" confirmations on Fix posts.
- [x] Added Helpful and Stale info signals.
- [x] Added moderator pin/unpin for important notes.
- [x] Added reporting, admin moderation queue, report dismissal, abusive post deletion, and owner blocking.
- [x] Added community rules and privacy/deletion notes.
- [x] Added real web image upload with size/type checks and JPEG storage.
- [x] Added product feedback capture and admin feedback inbox.
- [x] Added local feedback triage states and loop-stage routing for Product owner → Design → Engineering → QA follow-through.
- [x] Added a local real-user test-run log for scenario, outcome, friction, and next loop owner.
- [x] Added browser/client error capture for staging QA.
- [x] Added health endpoint with app version and service-center boundary status.
- [x] Added Vercel deployment config, SPA fallback routing, and launch-readiness panel.
- [x] Added a persisted production launch checklist for URL, deep-link refresh, headers, install metadata, offline smoke, and handoff verification.
- [x] Added install-ready web app manifest, icon, theme metadata, and app shortcuts.
- [x] Added online/offline status messaging for local-first tester sessions.
- [x] Added a persisted QA session checklist for launch smoke passes.
- [x] Added a persisted responsive QA matrix for phone, tablet, and desktop release passes.
- [x] Added a shareable QA handoff report with tester identity for Product → Design → Engineering → QA → Real User review.
- [x] Added local data backup export/import so testers can move MVP state before hosted sync exists.
- [x] Added a hosted API readiness map for local-first surfaces, beta sync needs, later sync needs, and service-center boundaries.
- [x] Added share buttons plus `/share/*` metadata landing pages for posts and model notebooks.
- [x] Added richer starter seed content for tester onboarding.
- [x] Added Docker staging packaging and staging deployment docs.
- [x] Kept service-center endpoints separate from the community product surface.

### Yet to be done

- [x] Merged the TypeScript web MVP feature PRs through post quality meter into `master`.
- [ ] Deploy the TypeScript webapp on Vercel and record the production URL in the launch panel.
- [ ] Run a visual responsive QA pass on the deployed Vercel URL, including the starter route, QA checklist, responsive QA matrix, and install prompt.
- [ ] Run an offline-mode smoke check in the deployed browser.
- [ ] Decide whether the first hosted backend is TypeScript/Fastify or the existing Ktor API using the hosted API readiness map.
- [ ] Add durable hosted persistence after the TypeScript web surface is validated.
- [ ] Replace local backup/restore with hosted account sync once persistence exists.
- [ ] Replace local subscription previews with real hosted notification jobs after accounts/persistence exist.
- [ ] Replace local profile/report/comment storage with hosted account and moderation APIs.
- [ ] Replace share/copy fallbacks with hosted deep links and Open Graph metadata after deployment.
- [ ] Replace local shortlist with hosted buyer workspace and cross-device sync.
- [ ] Replace local inspection checklists with hosted buyer inspection sessions and saved outcomes.
- [ ] Replace local city circles with hosted city pages and city follows.
- [ ] Replace local ownership playbooks with hosted model playbook pages and richer evidence scoring.
- [ ] Promote post quality scoring into hosted moderation/ranking once the backend path is selected.
- [ ] Run deployed real tester sessions through the product-owner → designer → backend → frontend → QA → real-user routing loop.
- [ ] Add hosted persistence/API for follows, garage, timeline, and feedback.
- [ ] Add basic notification/subscription flows after hosted follows exist.
- [ ] Add richer garage profile fields and timeline analytics.
- [ ] Replace local garage cost ledger with hosted running-cost analytics and cross-device history.
- [ ] Replace local garage reminders with hosted reminder scheduling and notification delivery.
- [ ] Add Google sign-in only after the lightweight profile flow proves insufficient.
- [ ] Harden production operations: backup restore drill, non-default admin token, logs, and monitoring vendor if needed.
- [ ] Bring the native Android app up to feature parity after the web MVP is validated.
- [ ] Keep service-center integration pending until the owning team provides its contract.

## Project layout

- `src` — active TypeScript webapp MVP
- `index.html`, `vite.config.ts`, `package.json` — Vercel-ready web build
- `server-kotlin/src/main/resources/web` — previous Kotlin-served webapp retained for reference/conversion
- `server-kotlin` — Ktor REST API and SQLite database
- `shared` — request/response models shared by app and server
- `android-app` — native Android app (Jetpack Compose)
- `docs/PRODUCT_ROADMAP.md` — launch scope and product ideas
- `docs/COMMUNITY_RULES.md` — posting and moderation standard
- `docs/SERVICE_CENTER_INTEGRATION.md` — separate service-center integration boundary
- `docs/RELEASE_CHECKLIST.md` — web MVP release checks
- `docs/STAGING_DEPLOYMENT.md` — Docker staging runbook
- `docs/PRIVACY_AND_DELETION.md` — current privacy and profile deletion notes

## Requirements

- Node.js 20+ for the TypeScript webapp
- JDK 17
- Android Studio with Android SDK 36 only when building the Android app

## Run locally

Run the active TypeScript web MVP:

```bash
npm install
npm run dev
```

Open `http://localhost:8080`.

The current TypeScript MVP is local-first so it can move quickly on Vercel while
the hosted backend decision is finalized. It includes owner posts, saved notes,
followed models/topics, a following feed, garage vehicles, timeline entries,
model notebooks, subscription previews, garage insights, feedback capture, and
QA/user loop panels. The starter route shows first-time testers how to set a
profile, follow a model, create a garage baseline, keep a useful note, and leave
feedback. It also has lightweight local profiles, comments, reports,
shareable notes/notebooks, garage export, local backup/restore, and a moderator queue so
trust-and-safety can be tested before backend wiring. Buyers can also keep a
local shortlist, compare models against available ownership notes, and generate
inspection checklists for test drives or used-car evaluations. Model playbooks
summarize owner signals and buyer checks from the same typed post data.
The write flow includes a detail quality meter so new posts become more useful
before they reach the community feed.

The web shell includes `public/manifest.json` and `public/icon.svg` so
Chrome/Android and supporting desktop browsers can present Autoflex as an
installable app surface.
The webapp also shows online/offline status so testers know local notes,
garage entries, backups, and feedback still work when connectivity drops.
The QA panel now keeps per-browser smoke-check progress and can share a handoff
report with the lightweight tester profile, so product, QA, and real-user
passes can see who verified what.

Run the web release gate before deploying:

```bash
npm run release:check
```

Run the preserved Kotlin web/API path:

```bash
./gradlew :server-kotlin:run --args=--seed
```

Use the Models button to browse owner posts grouped by model/variant details.

Moderation queue: open `http://localhost:8080/admin`. The local default admin
token is `dev-admin`; set `ADMIN_TOKEN` for any shared environment.

For Android, open this folder in Android Studio, run the backend, then run
`android-app` on an emulator.

The debug app connects to `http://10.0.2.2:8080`, which maps an Android
emulator to the backend running on the development computer. Override
`API_BASE_URL` for a physical device or hosted API.

Seed useful starter posts with the server's `--seed` argument. The starter set
covers reviews, known issues, fixes, costs, travelogues, comments, helpful
signals, and a pinned fix so testers can see model notebooks immediately.

Uploaded cover images are stored under `server-kotlin/data/uploads` by default.
Set `UPLOAD_DIR` to move them in a shared environment.

## Production checklist

- Deploy the active TypeScript webapp through Vercel.
- Run `npm run release:check`.
- Serve the future hosted API over HTTPS.
- Set `ADMIN_TOKEN`, `DATABASE_PATH`, `UPLOAD_DIR`, and `APP_VERSION`.
- Back up the database and upload directory.
- Use [RELEASE_CHECKLIST.md](/Users/priyanshtyagi/Auto-Motive-Flex/docs/RELEASE_CHECKLIST.md:1).
- Use [STAGING_DEPLOYMENT.md](/Users/priyanshtyagi/Auto-Motive-Flex/docs/STAGING_DEPLOYMENT.md:1) for the Docker staging path.
- Use [PRIVACY_AND_DELETION.md](/Users/priyanshtyagi/Auto-Motive-Flex/docs/PRIVACY_AND_DELETION.md:1) as the MVP privacy baseline.
- Keep service-center endpoints under `/api/service-centers/*`; another team owns
  that integration.
