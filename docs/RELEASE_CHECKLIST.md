# Autoflex TypeScript web MVP release checklist

## Active webapp checks

1. Run `npm run build`.
2. Run `npm run dev` and open `http://localhost:8080`.
3. Run `npm run test`.
4. Run `npm run release:check`.
5. Confirm the feed, filters, saved posts, following mode, starter route, city circles, ownership playbooks, post detail quality meter, buyer shortlist, buyer inspection checklists, profile form, comments, reports, moderator queue, write form, subscriptions, model notebooks, post sharing, notebook sharing, garage export, local backup/restore, garage timeline, garage reminders, garage running-cost ledger, garage insights, build loop, launch-readiness panel, install metadata, connection status, QA checklist, and feedback lane work.
6. Confirm the service-center integration boundary is visible and still treated as a separate workstream.
7. Deploy the TypeScript webapp through Vercel.
8. Confirm direct refresh on deep paths falls back to the app instead of a Vercel 404.
9. Confirm production responses include `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.
10. Confirm return-user nudges appear after following a model/topic, saving a note, or adding a garage vehicle.
11. Check responsive layout at phone, tablet, and desktop widths; confirm nav, forms, feed detail, shortlist cards, inspection checklists, and action buttons remain readable and tappable.
12. Confirm blocked, unavailable, or corrupt browser storage falls back safely without breaking the page.
13. Confirm app-level crash recovery shows a reload/try-again path instead of a blank page.
14. Submit tester feedback, move it through New/Reviewing/Planned/Shipped, and confirm triage counts update.
15. Export a local backup, restore it in a fresh browser/profile, and confirm posts, follows, garage, feedback, reports, and shortlist data return.
16. On a fresh browser/profile, confirm the starter route shows pending first actions and marks profile, follows, garage, saved/shortlist, and feedback steps complete as testers use them.
17. Confirm `/manifest.json` loads, references `/icon.svg`, uses standalone display, and exposes shortcuts for write, garage, and model notebooks.
18. Toggle the browser offline and confirm the connection strip explains that local posts, garage notes, backups, and feedback still work.
19. Tick and untick QA checklist items, refresh, and confirm checked smoke-pass items persist locally.
20. Share the QA handoff report and confirm it includes QA progress, launch blockers, feedback triage, and the service-center boundary.

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
