# Autoflex webapp release checklist

## Active webapp checks

1. Run `npm run build`.
2. Run `npm run dev` and open `http://localhost:8080`.
3. Run `npm run test`.
4. Run `npm run release:check`.
5. Confirm the four primary workspaces work: Today, Shortlist, Garage, and Community.
6. Confirm each workspace has one clear primary action: Add vehicle, Add candidate, Add service record, and Write a note.
7. Confirm Profile opens directly from the account control, its utility screens return correctly, and no duplicate account menu appears.
8. Confirm shortlist decisions, vehicle records, community search/detail/save/report, city filters, and profile settings retain local state across workspace changes and reloads.
9. Confirm Settings downloads a valid backup, opens the restore file picker, rejects invalid backups, and requires a second explicit action before clearing local data.
10. Confirm the deployed Vercel URL loads the current public MVP.
11. Confirm `#top`, `#shortlist`, `#garage`, `#feed`, `#write`, and Profile utility links survive refresh and browser Back/Forward navigation.
12. Confirm production responses include the configured content-type, referrer, permissions, framing, opener, resource, transport-security, and content-security headers.
13. Complete production operations outside the public UI: backup restore drill, non-default admin token, client-error path, release logs, monitoring owner, and HTTPS-only link.
14. Confirm return-user nudges appear after following a model/topic, saving a note, or adding a garage vehicle.
15. Check 390px phone, tablet, and 1280px desktop layouts; confirm the mobile dock, desktop rail, forms, details, lists, and primary actions remain readable, tappable, and free of horizontal overflow.
16. Confirm blocked, unavailable, or corrupt browser storage falls back safely without breaking the page.
17. Confirm app-level crash recovery shows a reload/try-again path instead of a blank page.
18. On a fresh browser/profile, confirm the starter route shows pending first actions and marks profile, follows, garage, and saved/shortlist steps complete as users interact.
19. Confirm `/manifest.json` loads, references the SVG and PNG install icons, uses standalone display, and exposes working shortcuts for write, shortlist, and garage.
20. Build and serve the production output, load it once, stop the server, and confirm a browser reload still renders the selected workspace from the generated offline shell.
21. Confirm the Vercel project is owned by the intended team, GitHub authors have deployment access, and the production branch targets the repository default branch.

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
