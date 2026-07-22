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

- `PORT`: HTTP port. Default: `8080`.
- `DATABASE_PATH`: SQLite database path. Default: `data/autoflex.db`.
- `UPLOAD_DIR`: uploaded image directory. Default: `data/uploads`.
- `ADMIN_TOKEN`: moderation token. Default local value: `dev-admin`.
- `APP_VERSION`: release label returned by `/api/health`. Default: `dev`.

## Pre-release checks

1. Run `./gradlew :server-kotlin:test`.
2. Build the staging image or distribution, then start the server with
   production env values.
3. For a fresh tester database, start once with `--seed` and confirm the Models
   hub has starter notebooks for Nexon, Creta, XUV700, and City.
4. Check `GET /api/health` returns status, version, and
   `service_center_status: "external"`.
5. Check `/`, `/admin`, `/api/posts`, and `/api/service-centers/status`.
6. Check `/api/models` returns model pages from posts with model details and
   issue/fix/cost counts.
7. Open the Models hub and confirm a model notebook groups known issues, fixes,
   cost notes, reviews, travelogues, and owner notes.
8. Confirm post and model Share buttons produce `/share/*` links and those pages
   expose Open Graph metadata.
9. Confirm a Fix post can be marked "worked for me" only once per token.
10. Confirm Helpful and Stale info can be marked only once per browser/profile token.
11. Confirm `/admin` can pin and unpin a reported post.
12. Submit web feedback and confirm it appears in the `/admin` feedback inbox.
13. Trigger or submit a client error and confirm it appears in `/admin`.
14. Confirm `/admin` can dismiss a report and remove an abusive reported post.
15. Confirm `/admin` can block a reported post owner from future community writes.
16. Confirm `DATABASE_PATH` and `UPLOAD_DIR` are backed up.
17. Set a non-default `ADMIN_TOKEN`.
18. Serve behind HTTPS.

## Service-center boundary

Keep service-center work under `/api/service-centers/*`. The current MVP only
exposes `GET /api/service-centers/status` because another team owns that
integration.
