# Autoflex web MVP release checklist

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
