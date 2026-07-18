# Autoflex staging deployment

This MVP ships as one Ktor webapp/API process. Service-center work remains
separate under `/api/service-centers/*`.

## Required environment

- `PORT`: web port, default `8080`.
- `DATABASE_PATH`: SQLite path, default `/data/autoflex.db` in Docker.
- `UPLOAD_DIR`: uploaded cover image path, default `/data/uploads` in Docker.
- `ADMIN_TOKEN`: required for `/admin`; do not use `dev-admin` outside local.
- `APP_VERSION`: release label returned by `/api/health`.

## Build and run

```bash
docker build -t autoflex-web:staging .
docker run --rm -p 8080:8080 \
  -e ADMIN_TOKEN=change-me \
  -e APP_VERSION=staging \
  -v autoflex-data:/data \
  autoflex-web:staging
```

## Smoke checks

1. Open `/`.
2. Open `/admin` and confirm reports, feedback, and client errors load.
3. Check `/api/health` returns `status`, `version`, and
   `service_center_status: "external"`.
4. Check `/api/service-centers/status` still returns `owned_by:
   "service-center-team"`.
5. Submit road-test feedback from the webapp and confirm it appears in `/admin`.

## Backups

Back up the mounted `/data` volume. It contains the SQLite database and uploaded
cover images.
