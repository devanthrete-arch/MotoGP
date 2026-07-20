# Autoflex web-first product roadmap

## Direction

Autoflex should launch as a webapp MVP first, then move to Android once the
community loop is validated. Team-BHP is the inspiration for deep ownership
detail, hot discussions, reviews, travelogues, and help articles; Autoflex
should make that spirit feel new-age with faster publishing, recoverable
profiles, saved knowledge, modern moderation, and later garage/model layers.
The imported Expo/React Native, TypeScript/Fastify, iOS, and web plan is now
treated as long-form product direction. The immediate MVP has pivoted back to a
TypeScript webapp so the web product can ship quickly on Vercel. Kotlin/Ktor and
Android remain available as later conversion paths rather than blockers for the
first web launch.

The product wedge is community first:

1. Record useful ownership knowledge.
2. Let people discuss, save, search, and trust it.
3. Add vehicle profiles and city groups once the feed has retention.
4. Pilot ride/trip recording only after the community loop works.

## Build loop

Every feature moves through:

1. Product owner: clarify the user value and success signal.
2. Designer: place the feature in the simplest usable flow.
3. Backend engineer: add durable API/data behavior.
4. Frontend engineer: make it usable in the web MVP.
5. Tested / QA: prove the behavior with tests and smoke checks.
6. Real user perspective: remove friction and name the next pain point.

## Phase 0: web MVP foundation

Target: 1-2 weeks.

- Freeze the first launch promise: "real ownership posts and discussions for
  Indian car buyers and owners."
- Ship the webapp MVP before mobile app work.
- Keep service-center endpoints separate while the webapp moves in TypeScript.
- Decide the first hosted backend after the TypeScript web surface is validated:
  either TypeScript/Fastify for stack consistency or the existing Ktor API for
  reuse.
- Prepare hosted API shape, environment config, backups, privacy policy,
  account deletion wording, and basic analytics events.
- Do not build iOS, native modules, 3D garage, trip scoring, navigation,
  commerce, or B2B tools in this phase.

Exit criteria:

- Webapp runs against local API.
- Backend tests pass.
- Launch checklist exists.
- First trust-and-safety feature is implemented.

## Phase 1: web beta community

Target: 6-8 weeks.

- Feed: latest/popular, search, brand/topic filters, post detail.
- Posting: create/edit/delete, Markdown-lite body, cover image URL until real
  upload is ready.
- Discussion: comments, likes, view counts.
- Trust: report post, moderation storage, spam throttling, community rules,
  blocked-user/device list.
- Accounts: start with the smallest recoverable profile flow, then add Google
  sign-in when the app is ready for testers.
- Reliability: pagination, rate limits, error states, crash reporting, staging
  API, database backups.

Exit criteria:

- 50-100 testers can create posts, comment, report abuse, and recover their
  profile.
- Moderation has enough backend data to act on reports.
- No native app, trip recording, scoring, or marketplace work is blocking beta.

## Phase 2: ownership utility

Target: 8-12 weeks after beta signal.

- Garage profiles: vehicle, variant, fuel, purchase date, city, odometer.
- Ownership timeline: service, repair, tyre, insurance, fuel and running costs.
- Saved posts, followed topics/models, notifications, shareable deep links.
- Model pages collecting reviews, known issues, fixes, and cost notes.
- Hindi support after the English flows are stable.

Exit criteria:

- Users return for their own garage/timeline, not only the public feed.
- Model pages answer buying and ownership questions better than generic search.

## Phase 3: Android app and ride pilot

Target: Android after web retention exists.

- Native Android app catches up to proven web flows.
- Foreground location service, offline trip storage, resume after app kill,
  privacy zones, and explicit trip sharing.
- Trip summary: distance, duration, route preview, notes, photos, share card.
- Battery/GPS testing across real devices before any public scoring.

Exit criteria:

- Recording is reliable enough that users trust it.
- Private-by-default trip data and privacy zones work.
- No speed rewards, public rankings, or lean-angle claims until accuracy is
  proven.

## Phase 4: scale bets

Only after retention and trust are real:

- Clubs, events, road trips, route discovery, and live location.
- Android Auto, offline maps, coaching, crash detection, OBD integrations.
- iOS, Expo/React Native, or Kotlin Multiplatform evaluation.
- Marketplace, insurance, service leads, and B2B tools with explicit consent.

## Execution status

Phase 0 is now active for TypeScript web-first execution:

- Active webapp MVP lives at the repo root in Vite/React/TypeScript.
- Ktor API, shared Kotlin models, native Android app, and backend tests remain
  in the repo for later conversion/reuse.
- The repo is intentionally not pursuing iOS or native modules before the web
  community loop proves useful.

Completed slices:

- Community feed, search, filters, post detail, comments, likes, views.
- Create, edit, and delete posts with local device ownership.
- Post reporting from Android into backend moderation storage.
- Paged feed API, Android "Load more" flow, and web "Load more" flow.
- Web saved posts with anonymous save token and backend persistence.
- In-memory rate limiting for write actions in the web MVP.
- Lightweight recoverable profiles with display name, profile token, and recovery code.
- Profile-owned posts, so recovered profiles can edit/delete their own posts
  across browsers while old local edit tokens still work.
- Admin moderation queue at `/admin`, with report dismissal and abusive post removal.
- Community rules in the webapp and block-token moderation for reported post owners.
- Structured ownership details on posts: model, variant, city, and odometer.
- Models hub generated from community posts, so reviews, fixes, and costs start
  becoming browsable knowledge pages.
- Knowledge labels on posts: owner note, review, known issue, fix, cost note,
  and travelogue. Model cards now surface issue/fix/cost counts.
- Dedicated model notebook view with grouped known issues, fixes, cost notes,
  reviews, travelogues, and owner notes.
- Verified-fix signal: owners can mark a Fix post as "worked for me", with
  duplicate-safe counts surfaced in model notebooks.
- Model-page quality signals: helpfulness, stale-info flags, and moderator
  pinning for important notes.
- Real web cover image upload with local storage, size/type checks, and JPEG re-encode.
- Release readiness basics: health check, release checklist, privacy/deletion notes,
  and lightweight profile deletion.
- Real-user feedback lane: web feedback dialog, backend feedback storage, and
  admin feedback inbox for product-owner review.
- Staging readiness: Docker packaging, app-version health response, and client
  error capture surfaced in the admin inbox.
- Tester onboarding: richer seeded starter garage content plus empty states
  that point users toward the first useful ownership note.
- Share/deep-link polish: post and model share controls plus lightweight
  metadata landing pages for link previews.
- Service-center namespace reserved separately at `/api/service-centers/*`.

Next web MVP slices, in order:

1. Merge the TypeScript web MVP PR.
2. Deploy the TypeScript webapp on Vercel.
3. Add hosted persistence/API after the web flows are validated.
4. Replace local profile/comment/report storage with hosted account and moderation APIs.
5. Replace local share/copy actions with hosted deep links and Open Graph metadata.
6. Replace local subscription previews with real hosted notification jobs.
7. Add richer garage profile analytics and ownership timeline summaries beyond the current MVP insight cards.
8. Android/Kotlin catch-up after web MVP validation.

Service-center integration stays outside this loop until the owning team hands
over its contract. Current placeholder: `GET /api/service-centers/status`.
