# Autoflex staging deployment

The active hosted backend path ships as a TypeScript/Fastify API process.
Service-center work remains separate under `/api/service-centers/*`.

## Required environment

- `PORT`: API port, default `3001`.
- `API_DATA_PATH`: JSON persistence path, default `/data/autoflex-api.json` in Docker.
- `ADMIN_TOKEN`: required for internal moderation and feedback queues; do not
  use `dev-admin` outside local.
- `APP_VERSION`: release label returned by `/health` and `/api/health`.
- `CORS_ORIGINS`: comma-separated origin allowlist for shared environments.

## Build and run

```bash
docker build -t autoflex-web:staging .
docker run --rm -p 3001:3001 \
  -e ADMIN_TOKEN=change-me \
  -e APP_VERSION=staging \
  -e CORS_ORIGINS=https://staging.example.com \
  -v autoflex-data:/data \
  autoflex-web:staging
```

## Smoke checks

1. Check `/api/health` returns `status: "ok"`, `version`,
   `storage: "file"`, and `serviceCenterBoundary: "reserved"`.
2. Submit a post, comment, report, feedback item, follow, save, garage vehicle,
   timeline entry, shortlist item, and inspection session through the API.
3. Restart the container and confirm the submitted records remain present.
4. Confirm internal moderation and feedback list routes reject requests without
   `x-admin-token` or `Authorization: Bearer <ADMIN_TOKEN>`.
5. Check `/api/service-centers/search` still returns the reserved boundary
   response owned by the separate service-center team.

## Backups

Back up the mounted `/data` volume. In the TypeScript API beta path it contains
the JSON API data file. Replace this file-backed persistence with the selected
production database before public scale.
