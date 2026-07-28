# Reviewer / Critic Handoff

Date: 2026-07-28
Scope: MotoGP / Autoflex webapp launch-readiness review

## Launch blockers

1. **Documentation overstates the active webapp.** The README and release checklist describe stale signals, pin/unpin, owner blocking, image upload, hosted `/share/*` links, client error capture, and an `/admin` moderation queue as completed or active. The current React experience instead uses local helpful/worked-for-me signals, local reports, and a public `#moderation` panel. Align the launch documentation with the actual TypeScript webapp, or finish and verify those features before launch. See [README.md](../README.md:63), [README.md](../README.md:194), and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md:35).

2. **Moderation is not safe to expose as a hosted API.** The TypeScript moderation endpoints have no authentication or authorization, while the web UI exposes moderator actions in the main app. Anyone who can reach the API could list reports or dismiss/remove content. Add real admin authentication and keep the moderation surface out of the public user route before deploying this API. See [server-ts/app.ts](../server-ts/app.ts:157) and [src/App.tsx](../src/App.tsx:1407).

3. **Hosted writes accept malformed ownership data.** Several API routes validate only a few required strings, then cast request bodies directly into domain types. Invalid enums, missing nested fields, and non-numeric values can enter the store and later break filtering, ranking, or rendering. Introduce shared request schemas and reject invalid payloads before treating them as `DraftPost`, garage, timeline, or shortlist records. See [server-ts/app.ts](../server-ts/app.ts:100), [server-ts/app.ts](../server-ts/app.ts:211), and [src/storage.ts](../src/storage.ts:210).

## Major findings

1. **Trust signals can be inflated by repeated clicks.** `markHelpful` and `confirmFix` increment counters every time the same user clicks, with no per-user or per-device deduplication. This makes “community confidence” easy to manipulate and weakens the app’s core ownership guidance. See [src/App.tsx](../src/App.tsx:303).

2. **Report copy implies delivery that is only local.** The UI says a report is sent to moderators, but the action writes to local storage and there is no visible delivery/failure state tied to a hosted moderation service. Change the copy to explain local demo behavior, or connect it to a real report endpoint with a clear result. See [src/App.tsx](../src/App.tsx:329) and [src/App.tsx](../src/App.tsx:880).

3. **Share is not a durable shared experience.** The current action uses the browser share sheet or clipboard and shares generated text, but does not create a URL/deep link that another person can open to the same post. The release checklist still expects `/share/*`. Decide whether share is text-only for the MVP or implement hosted post routes and link previews before claiming share is complete. See [src/App.tsx](../src/App.tsx:353), [src/insights.ts](../src/insights.ts:697), and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md:47).

## Product and design assessment

The product direction is useful and domain-specific: it connects model ownership context, known issues, fixes, maintenance timing, and service-center boundaries. The strongest launch story is a trusted ownership notebook that helps a rider buy with fewer surprises and remember what to do next.

The visual system is more intentional than a generic dashboard, but the brown/orange palette and repeated panel treatment could still read as a themed template rather than a distinctive MotoGP tool. Keep the information density and strong labels, then make the bike/model, service status, and confidence signals the first-viewport anchors. A browser pass at narrow mobile widths is still needed to confirm controls do not crowd or introduce horizontal scrolling; the CSS has responsive breakpoints, but this review did not run a visual browser session.

## Verification

- `npm run test` passed: 5 files, 47 tests.
- `npm run build` passed.
- `npm run release:check` passed.
- Kotlin tests were not runnable because this environment has no Java runtime.
- No application code changes were made in this session.

## Handoff recommendations

1. Backend: add schema validation and authenticated moderation before any hosted deployment; confirm persistence is durable rather than in-memory.
2. Frontend: reconcile visible claims and moderation/report language with the actual storage boundary; add a narrow mobile browser smoke pass.
3. Product owner: choose the launch contract for trust signals and sharing, then remove any checklist/README claims that are intentionally deferred.
4. QA: add smoke coverage for malformed API payloads, repeated trust clicks, report delivery/failure, moderation authorization, and shared-link opening.

## Remaining risks

This is a documentation-only handoff. The findings above remain open in the application; passing the current test/build checks does not establish hosted persistence, moderation authorization, payload safety, or durable sharing.

## Frontend PR #2 review

Reviewed `https://github.com/devanthrete-arch/MotoGP/pull/2` at commit `c45d26c` against `codex/frontend-features-motogp`.

### Findings

1. **Major: the decision board silently hides shortlist models after four.** The new board renders `shortlistDecisionLanes.slice(0, 4)` with no count, overflow affordance, or link to the remaining comparison cards. A buyer with five or more candidates can therefore miss an urgent risk or evidence gap even though the underlying shortlist still contains it. Render all lanes responsively, or provide an explicit “show all” state and preserve the priority ordering. See [src/App.tsx](../src/App.tsx:916).

2. **Moderate accessibility: lane priority is color-only.** High/medium/low priority is encoded by the left-border colors in CSS, but the lane markup exposes only the decision label, model, signal, and action. The cockpit’s “buyer alerts” count also does not explain which lanes are urgent. Add a visible priority label or equivalent text so urgency survives color-blind viewing and screen-reader use. See [src/App.tsx](../src/App.tsx:917) and [src/styles.css](../src/styles.css:1962).

### Assessment

The PR improves practical buyer clarity: it turns raw shortlist status and model-note counts into a next action such as gathering evidence, inspecting risk, or booking a test drive. The new pure helper is easy to test, and the PR adds focused coverage for ordering, evidence gaps, and archived decisions. The cockpit and ledger styling feel more domain-specific without introducing an obvious keyboard or responsive regression in static review; the new grids collapse at the existing mobile breakpoints.

### PR verification

- `npm run test` on `c45d26c`: passed, 5 files and 48 tests.
- `npm run build` on `c45d26c`: passed.
- `git diff --check`: passed.

## Final consolidated frontend review

Reviewed PR #2 at commit `370edee`.

### Verdict: approve

The replacement now behaves like a coherent operational ownership app rather than a blog or landing page. Today/Home gives an owner a current car, next service task, odometer, logged cost, and first-run choices. Shortlist gives a buyer evidence lanes, inspection checks, status, budget, and decision notes. Garage gives the selected vehicle, service/cost entry, reminders, timeline, and running-cost ledger. Community gives searchable owner evidence, detail inspection, filtering, and a focused write flow. Profile is now a real account surface with saved notes, following, notifications, and privacy/settings subsections.

The four-tab navigation is stable and understandable, the account entry point is consistently labeled Profile, the vehicle selector has a visible current-car state plus keyboard/escape/focus behavior, and contextual Add actions open the relevant form and focus its first field. The large More grid and oversized marketing hierarchy are gone; the screen now communicates what needs attention and what to do next without requiring a manual.

### Remaining release risks

- The app is still local-first, so profile, reports, trust signals, and ownership records are device-local until hosted persistence/authentication is delivered.
- The current reviewer pass was code/static plus test/build validation; a visual browser pass remains advisable for final spacing at real desktop and mobile widths because `agent-browser` is unavailable in this environment.

### Final verification

- `npm run test` on `370edee`: passed, 5 files and 48 tests.
- `npm run build` on `370edee`: passed.
- `git diff --check`: passed.
