# Autoflex

Autoflex is a web-first MVP for an ownership-focused auto community inspired by
Team-BHP's depth of owner details, reviews, help articles, and hot discussions.
The current build uses a Ktor API, a served webapp, shared Kotlin DTOs, SQLite
persistence, and a native Android app kept as the next platform path.

## Project layout

- `server-kotlin/src/main/resources/web` — webapp MVP
- `server-kotlin` — Ktor REST API and SQLite database
- `shared` — request/response models shared by app and server
- `android-app` — native Android app (Jetpack Compose)
- `docs/PRODUCT_ROADMAP.md` — launch scope and product ideas
- `docs/COMMUNITY_RULES.md` — posting and moderation standard
- `docs/SERVICE_CENTER_INTEGRATION.md` — separate service-center integration boundary
- `docs/RELEASE_CHECKLIST.md` — web MVP release checks
- `docs/STAGING_DEPLOYMENT.md` — Docker staging runbook
- `docs/PRIVACY_AND_DELETION.md` — current privacy and profile deletion notes

## Requirements

- JDK 17
- Android Studio with Android SDK 36 only when building the Android app

## Run locally

Run the web MVP and API:

```bash
./gradlew :server-kotlin:run --args=--seed
```

Open `http://localhost:8080`.

Use the Models button to browse owner posts grouped by model/variant details.

Moderation queue: open `http://localhost:8080/admin`. The local default admin
token is `dev-admin`; set `ADMIN_TOKEN` for any shared environment.

For Android, open this folder in Android Studio, run the backend, then run
`android-app` on an emulator.

The debug app connects to `http://10.0.2.2:8080`, which maps an Android
emulator to the backend running on the development computer. Override
`API_BASE_URL` for a physical device or hosted API.

Seed useful starter posts with the server's `--seed` argument. The starter set
covers reviews, known issues, fixes, costs, travelogues, comments, helpful
signals, and a pinned fix so testers can see model notebooks immediately.

Uploaded cover images are stored under `server-kotlin/data/uploads` by default.
Set `UPLOAD_DIR` to move them in a shared environment.

## Production checklist

- Serve the app/API over HTTPS.
- Set `ADMIN_TOKEN`, `DATABASE_PATH`, `UPLOAD_DIR`, and `APP_VERSION`.
- Back up the database and upload directory.
- Use [RELEASE_CHECKLIST.md](/Users/priyanshtyagi/Auto-Motive-Flex/docs/RELEASE_CHECKLIST.md:1).
- Use [STAGING_DEPLOYMENT.md](/Users/priyanshtyagi/Auto-Motive-Flex/docs/STAGING_DEPLOYMENT.md:1) for the Docker staging path.
- Use [PRIVACY_AND_DELETION.md](/Users/priyanshtyagi/Auto-Motive-Flex/docs/PRIVACY_AND_DELETION.md:1) as the MVP privacy baseline.
- Keep service-center endpoints under `/api/service-centers/*`; another team owns
  that integration.
