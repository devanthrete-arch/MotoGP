# Autoflex TypeScript web MVP release checklist

## Active webapp checks

1. Run `npm run build`.
2. Run `npm run dev` and open `http://localhost:8080`.
3. Run `npm run test`.
4. Run `npm run release:check`.
5. Confirm the public MVP surfaces work: feed, filters, saved posts, following mode, starter route, city circles, ownership playbooks, post detail quality meter, buyer shortlist, buyer inspection checklists, profile form, privacy readiness panel, comments, reports, moderator queue, write form, subscriptions, model notebooks, post sharing, notebook sharing, garage export, garage timeline, garage reminders, garage running-cost ledger, garage insights, build loop, install metadata, and connection status.
6. Confirm the service-center integration boundary is visible and still treated as a separate workstream.
7. Confirm the next-team handoff docs list community, profile, garage, buyer, sharing, notification, and service-center boundaries without assigning service-center work to the webapp team.
8. Confirm the privacy readiness panel states what is stored for the local MVP, what is not collected, the deletion baseline, and the service-center privacy boundary.
9. Confirm the deployed Vercel URL loads the current public MVP.
10. Confirm direct refresh on deep paths falls back to the app instead of a Vercel 404.
11. Confirm production responses include `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.
12. Complete production operations outside the public UI: backup restore drill, non-default admin token, client-error path, release logs, monitoring owner, and HTTPS-only link.
13. Confirm return-user nudges appear after following a model/topic, saving a note, or adding a garage vehicle.
14. Check responsive layout at phone, tablet, and desktop widths; confirm nav, forms, feed detail, shortlist cards, inspection checklists, and action buttons remain readable and tappable.
15. Confirm blocked, unavailable, or corrupt browser storage falls back safely without breaking the page.
16. Confirm app-level crash recovery shows a reload/try-again path instead of a blank page.
17. On a fresh browser/profile, confirm the starter route shows pending first actions and marks profile, follows, garage, and saved/shortlist steps complete as users interact.
18. Confirm `/manifest.json` loads, references `/icon.svg`, uses standalone display, and exposes shortcuts for write, garage, and model notebooks.
19. Toggle the browser offline and confirm the connection strip explains that local posts, garage notes, saved notes, and shortlist work still work.

## Required environment

- `PORT`: web or API port. The Vite web default is `8080`; the TypeScript API
  default is `3001`.
- `API_DATA_PATH`: optional JSON persistence file for the TypeScript API beta
  path. Leave unset for seeded in-memory local development.
- `ADMIN_TOKEN`: moderation token for internal API queues. Default local value:
  `dev-admin`; use a non-default value outside local development.
- `APP_VERSION`: release label returned by `/health` and `/api/health`. Default:
  `dev`.
- `CORS_ORIGINS`: comma-separated origin allowlist for shared TypeScript API
  environments. Leave unset only for local development.

## Pre-release checks

1. Run `npm run release:check`.
2. Start the TypeScript API with shared-environment values:
   `API_DATA_PATH`, `ADMIN_TOKEN`, `APP_VERSION`, and `CORS_ORIGINS`.
3. Check `GET /api/health` returns `status: "ok"`, the release version,
   `storage: "file"` when `API_DATA_PATH` is set, and
   `serviceCenterBoundary: "reserved"`.
4. Confirm `GET /api/moderation/reports`, `PATCH
   /api/moderation/reports/:reportId`, and `GET /api/feedback` reject requests
   without the admin token.
5. Confirm public `POST /api/reports` and `POST /api/feedback` still accept
   valid community/tester submissions.
6. Restart the API and confirm posts, comments, reports, follows, saves, garage
   vehicles, timeline entries, shortlist items, inspections, and feedback remain
   present when `API_DATA_PATH` is set.
7. Back up the API data file, or replace JSON persistence with the selected
   production database before public scale.
8. Set a non-default `ADMIN_TOKEN`.
9. Serve the webapp and any hosted API endpoint behind HTTPS.

Run `./gradlew :server-kotlin:test` only when touching the preserved Kotlin/Ktor
or Android conversion path.

## Service-center boundary

Keep service-center work under `/api/service-centers/*`. The TypeScript API
currently returns a reserved boundary response there because another team owns
that integration.
