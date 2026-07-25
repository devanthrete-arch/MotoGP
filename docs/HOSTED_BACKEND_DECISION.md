# Hosted backend decision

## Decision

Use a **TypeScript/Fastify hosted API first** for the web MVP.

## Why

- The current launch priority is the TypeScript webapp.
- A TypeScript API keeps the web MVP, validation tests, request models, and
  deployment loop in one language while the product is still changing quickly.
- It avoids forcing the Kotlin/Ktor path into the critical launch path before
  the web MVP proves the product loop.
- The existing Kotlin/Ktor and Android folders stay in the repo as the later
  Android/native conversion path.

## Boundary

Service-center integration remains separate. Do not mix service-center
contracts into the community MVP API until the owning team provides its contract.

## First hosted API surfaces

1. Profile, saved posts, comments, reports, and moderation actions.
2. Follows, garage vehicles, garage timeline, and feedback.
3. Buyer shortlist and inspection sessions.
4. Hosted share/deep-link metadata for posts and model notebooks.
5. Notification preferences and delivery jobs after hosted follows exist.

## Current implementation

The repo now includes `server-ts`, a Fastify API foundation with in-memory
repositories and tests for:

- `GET /health`
- `GET /api/profiles/:profileId`
- `PUT /api/profiles/:profileId`
- `GET /api/posts`
- `POST /api/posts`
- `GET /api/posts/:postId/comments`
- `POST /api/posts/:postId/comments`
- `POST /api/reports`
- `GET /api/moderation/reports`
- `PATCH /api/moderation/reports/:reportId`
- `GET /api/follows/:profileId`
- `PUT /api/follows/:profileId`
- `GET /api/saves/:profileId`
- `PUT /api/saves/:profileId`
- `GET /api/garage/vehicles`
- `POST /api/garage/vehicles`
- `GET /api/garage/timeline`
- `POST /api/garage/timeline`
- `GET /api/shortlist`
- `POST /api/shortlist`
- `GET /api/inspections`
- `POST /api/inspections`
- `GET /api/feedback`
- `POST /api/feedback`

`/api/service-centers/*` intentionally returns a boundary response until the
separate owning team provides its contract.

## Next backend step

Replace the in-memory repositories with durable hosted persistence. Start with
posts, comments, reports, profiles, saves, follows, garage vehicles, timeline
entries, shortlist items, and inspection sessions.
