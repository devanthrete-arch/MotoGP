# Service center integration boundary

Another team owns service-center integration. Autoflex keeps that work separate
from the community MVP.

Reserved namespace:

- `GET /api/service-centers/status`

Current behavior:

- Returns an ownership/status marker only.
- Does not create service requests.
- Does not store workshop, appointment, estimate, or lead data.
- Does not share community post data with service-center systems.

When the service-center team is ready, they can add endpoints under
`/api/service-centers/*` without changing feed, post, comment, saved-post, or
moderation flows.
