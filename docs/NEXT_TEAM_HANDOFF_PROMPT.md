# Prompt for the next implementation team

You are taking over Autoflex after the TypeScript web MVP cleanup PR.

## Current product direction

Autoflex is a web-first TypeScript MVP for a new-age automotive ownership
community. It should feel like a useful owner notebook and buyer research tool:
real reviews, known issues, verified fixes, cost notes, travelogues, garage
timelines, local city signals, model notebooks, buyer shortlist, inspection
checks, comments, reports, moderation, privacy notes, and notification
preferences.

Do not make the public webapp look like an internal project dashboard. Internal
QA, launch, backup, and product-loop tracking belong in docs/admin tooling, not
the customer-facing homepage.

## Decisions already made

- Keep building the MVP in TypeScript for the webapp.
- Use TypeScript/Fastify as the first hosted backend path.
- Keep Kotlin/Ktor and Android code preserved for later Android/native work.
- Keep service-center integration separate until the owning team provides its
  contract.
- Vercel deployment is already running; validate against the actual production
  URL supplied by the owner.

## Next priorities

1. Run deployed responsive QA on the Vercel URL.
   - Check phone, tablet, desktop.
   - Verify nav, feed, post detail, write flow, garage, shortlist, model
     notebooks, city circles, privacy, and subscription settings.
2. Run deployed offline smoke.
   - Confirm the app explains offline/local-first behavior.
   - Confirm local saved notes, garage/timeline entries, shortlist, and reports
     still work in the browser.
3. Build the TypeScript/Fastify hosted API foundation.
   - Status: first foundation exists in `server-ts`.
   - Routes now cover profiles, posts, comments, reports, moderation, follows,
     saved posts, garage vehicles, timeline entries, shortlist, inspections,
     and feedback ingestion.
   - Keep service-center routes/contracts out of this API until handed over.
4. Add durable hosted persistence.
   - This is now the next backend build step.
   - Start with core community data behind the existing Fastify routes: posts,
     comments, reports, profiles, saves, follows, garage, timeline, shortlist,
     and inspection sessions.
5. Replace local-only flows gradually.
   - Account-backed saves and follows.
   - Hosted buyer workspace.
   - Hosted inspection sessions.
   - Hosted city pages and model playbooks.
   - Hosted notification jobs after follows exist.
   - Hosted moderation/ranking using post quality signals.

## Non-negotiables

- Keep the public MVP clean and customer-facing.
- Preserve the ownership loop: owner knowledge → buyer usefulness → garage
  retention → community trust → repeat visits.
- Keep all copy plain and product-facing; avoid internal phrases like “QA
  handoff,” “launch readiness,” or “backend decision” in the main UI.
- Maintain responsive behavior before adding new surfaces.
- Run `npm run release:check` before every PR.
