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
   later conversion.
5. **Add durable hosted persistence.** Start with follows, garage, timeline,
   feedback, profile, reports, comments, and saved posts after the deployed web
   surface is validated.

## Full priority order

1. Deploy TypeScript webapp on Vercel and record the production URL.
2. Run visual responsive QA on the deployed URL.
3. Run offline-mode smoke check on the deployed URL.
4. Use TypeScript/Fastify as the first hosted API path for web MVP speed.
5. Add durable hosted persistence for the core community data.
6. Add hosted persistence/API for follows, garage, timeline, and feedback.
7. Replace local profile, reports, comments, and moderation with hosted APIs.
8. Replace local backup/restore with hosted account sync.
9. Replace saved posts with hosted account-backed saves.
10. Replace local shortlist with a hosted buyer workspace.
11. Replace local inspection checklists with hosted inspection sessions.
12. Replace local city circles with hosted city pages and city follows.
13. Replace local ownership playbooks with hosted model playbook pages.
14. Promote post quality scoring into hosted moderation/ranking.
15. Replace share/copy fallbacks with hosted deep links and Open Graph metadata.
16. Replace local subscription previews with real notification jobs.
17. Add basic notification/subscription flows after hosted follows exist.
18. Add richer garage profile fields and timeline analytics.
19. Replace local garage cost ledger with hosted running-cost analytics.
20. Replace local garage reminders with hosted reminder scheduling and delivery.
21. Run deployed real tester sessions through the full product loop.
22. Complete production operations hardening on the deployed URL.
23. Add Google sign-in only if the lightweight profile flow proves insufficient.
24. Bring native Android to feature parity after the web MVP is validated.
25. Keep service-center integration pending until its owning team provides the
    contract.
