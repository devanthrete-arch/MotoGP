# Autoflex pending priorities

This is the production-first order for the remaining TypeScript webapp work. It
keeps service-center integration separate and leaves Android/Kotlin feature
parity until the web MVP proves the community loop.

## Top 5 production priorities

1. **Deploy the TypeScript webapp on Vercel.** This unlocks real-device QA and
   real tester sessions. Status: blocked until the Vercel production URL exists.
2. **Run deployed responsive QA.** Check phone, tablet, desktop, starter route,
   install prompt, QA checklist, and responsive QA matrix on the production URL.
   Status: blocked until deployment.
3. **Run deployed offline smoke.** Confirm the local-first MVP still behaves
   clearly when the deployed browser goes offline. Status: blocked until
   deployment.
4. **Lock the first hosted backend path.** Decision: use a TypeScript/Fastify
   API first for the web MVP, while keeping the Ktor/Android path preserved for
   later conversion. Status: done; first Fastify route foundation exists in
   `server-ts`.
5. **Add durable hosted persistence.** Start with follows, garage, timeline,
   feedback, profile, reports, comments, and saved posts after the deployed web
   surface is validated.

## Full priority order

1. Deploy TypeScript webapp on Vercel and record the production URL.
2. Run visual responsive QA on the deployed URL.
3. Run offline-mode smoke check on the deployed URL.
4. Add durable hosted persistence behind the existing TypeScript/Fastify API routes.
5. Wire the webapp to hosted profile, reports, comments, moderation, follows, saves, garage, timeline, shortlist, inspections, and feedback APIs.
6. Replace local backup/restore with hosted account sync.
7. Replace saved posts with hosted account-backed saves.
8. Replace local shortlist with a hosted buyer workspace.
9. Replace local inspection checklists with hosted inspection sessions.
10. Replace local city circles with hosted city pages and city follows.
11. Replace local ownership playbooks with hosted model playbook pages.
12. Promote post quality scoring into hosted moderation/ranking.
13. Replace share/copy fallbacks with hosted deep links and Open Graph metadata.
14. Replace local subscription previews with real notification jobs.
15. Add basic notification/subscription flows after hosted follows exist.
16. Add richer garage profile fields and timeline analytics.
17. Replace local garage cost ledger with hosted running-cost analytics.
18. Replace local garage reminders with hosted reminder scheduling and delivery.
19. Run deployed real tester sessions through the full product loop.
20. Complete production operations hardening on the deployed URL.
21. Add Google sign-in only if the lightweight profile flow proves insufficient.
22. Bring native Android to feature parity after the web MVP is validated.
23. Keep service-center integration pending until its owning team provides the
    contract.
