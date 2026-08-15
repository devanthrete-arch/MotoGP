# Autoflex launch panel

The single record of **where Autoflex runs**, what is safe to ship, and what is
deliberately not built yet. If a fact about hosting, keys, tables or sharing is
in dispute, this file wins — update it in the same change that moves the system.

Last reviewed: 2026-08-15.

---

## 1. Web hosting — Vercel

| Setting | Value |
| --- | --- |
| Project | `moto-gp` |
| Project ID | `prj_9FPJtcBujaE4grCuY7jYNpnc7uPD` |
| Team | Anthrete Innovation Pvt Ltd (`team_UbuCWuxfzZk7x4lvirkSmkvj`) |
| Production branch | `master` |
| Production URL | https://moto-gp-chi.vercel.app |
| Branch alias (master) | `moto-gp-git-master-anthrete-innovation-pvt-ltd.vercel.app` — serves `x-robots-tag: noindex`, do not share it |
| Latest production deployment | commit `9d516c8` (verified live: routes 200, OG shim serving, offline shell registered) |
| Framework preset | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` (`tsc -b` → `vite build` → service-worker generation) |
| Output directory | `dist` |
| Function region | `iad1` |
| Serverless functions | `api/og.js` only (social-crawler Open Graph shim) |

The origin is **configurable, never hardcoded in app logic**. Resolution order
in `src/share.ts`:

1. an explicit `{ origin }` passed to the call,
2. `VITE_PUBLIC_ORIGIN` (build-time env),
3. `window.location.origin` (whatever host the user is actually on),
4. `defaultShareOrigin` — the constant fallback, which is the only place the
   current Vercel host is written down in app code.

`api/og.js` resolves the same way at runtime but reads `VITE_PUBLIC_ORIGIN`,
then `x-forwarded-host`, then `VERCEL_URL`, then the same fallback. When a
custom domain lands, set `VITE_PUBLIC_ORIGIN` in the Vercel project and update
`defaultShareOrigin` plus the canonical/`og:` URLs in `index.html`.
`src/share.test.ts` fails if `index.html` and `defaultShareOrigin` disagree.

### Security headers (must not weaken)

`vercel.json` applies to `/(.*)`:

- `Content-Security-Policy: default-src 'self'; base-uri 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'; style-src 'self'; upgrade-insecure-requests`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Vary: User-Agent` on document routes only (added for the crawler shim; hashed
  assets under `/assets/` keep their immutable one-year cache untouched).

No `'unsafe-inline'` and no `'unsafe-eval'` anywhere. Consequences that everyone
touching markup must respect: **no inline `<script>` and no inline `style="…"`
attributes** in `index.html` or in anything `api/og.js` prints. The legacy copy
fallback in `src/share.ts` positions its scratch textarea through CSSOM
(`element.style.position = …`), which CSP allows, rather than a style attribute,
which it blocks. `src/share.test.ts` asserts the CSP still contains
`script-src 'self'` and `frame-ancestors 'none'` and still contains no
`unsafe-inline`.

---

## 2. Hosted data — Supabase

| Setting | Value |
| --- | --- |
| Project name | Auto-Moto |
| Project ref | `uxzdmlqyxausmmdpmkrr` |
| Region | `ap-south-1` (Mumbai) |
| URL | `https://uxzdmlqyxausmmdpmkrr.supabase.co` |
| Client env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Postgres | 14.15 wire compatibility, RLS enabled on all 23 public tables |

### Tables by purpose

**Identity and preferences (4)**
`profiles`, `subscription_settings`, `follows`, `city_follows`

**Owner's own vehicles (4)**
`garage_vehicles`, `timeline_entries`, `garage_costs`, `garage_reminders`

**Buying decisions (3)**
`shortlist_items`, `inspection_sessions`, `inspection_items`

**Community content (3)**
`owner_posts`, `post_comments`, `saved_posts`

**Public knowledge surfaces (4)**
`city_circles`, `model_playbooks`, `playbook_entries`, `post_quality_scores`

**Trust and feedback (2)**
`reports`, `feedback_entries`

**Delivery and recovery (3)**
`notification_jobs`, `notification_deliveries`, `autoflex_user_backups`

### RLS posture

- **Owner-scoped (read and write gated on `auth.uid()`):** `profiles`,
  `subscription_settings`, `follows`, `city_follows`, `garage_vehicles`,
  `timeline_entries`, `garage_costs`, `garage_reminders`, `shortlist_items`,
  `inspection_sessions`, `inspection_items`, `saved_posts`,
  `notification_jobs`, `notification_deliveries`, `autoflex_user_backups`,
  `feedback_entries`. Nobody can read another person's garage, documents,
  shortlist, reminders or backups.
- **Public-read, owner-write:** `owner_posts`, `post_comments`. Anyone (including
  anonymous) may read; only the signed-in author may insert, update or delete
  their own row.
- **Public-read, curator/author-write:** `city_circles`, `model_playbooks`,
  `playbook_entries`, `post_quality_scores`. These are the derived knowledge
  surfaces the `/cities`, `/cars` and `/playbooks` deep links point at.
- **Reporter-scoped:** `reports` is private to the person who filed it. Any
  moderator view must come from a server-side role, not from the client key.

`profiles` is owner-private, so **there is no public profile page**: a
`/profile*` deep link is only meaningful to its owner, and the crawler shim
serves those routes the generic card, never a person's details.

Key handling:

- The **publishable (anon) key is safe to ship** in the client bundle and in
  `api/og.js`. It is a public identifier; RLS is what protects the data. It is
  already committed as a fallback in `src/supabase.ts`.
- The **service role key must never** appear in this repo, in a Vercel build
  env exposed to the client, in a chat message, in an issue, or in a log line.
  Any server work needing it belongs in a separate backend with its own secret
  store. If it is ever pasted anywhere, rotate it in the Supabase dashboard
  before doing anything else.
- `api/og.js` uses the publishable key against public-read tables only
  (`owner_posts`, `model_playbooks`, `city_circles`), with a 1.2 s timeout and a
  full try/catch, and degrades to slug-derived copy on any failure.

---

## 3. Local-first behaviour contract

1. **The device is the source of truth for a signed-out owner.** Garage,
   timeline, shortlist, documents and drafts are written to browser storage
   first and remain usable with no network and no account.
2. **Signing in adds sync, it never takes data away.** A hosted round trip is an
   enhancement; a failed round trip degrades to the local record and an action
   message, never to a blank screen or a silent loss.
3. **Nothing personal leaves the device without an explicit action.** Documents
   in the vault stay local. Posting to the community is the deliberate,
   user-initiated publish step.
4. **Export and delete are always available.** Settings can produce a full JSON
   backup and can clear local data behind a second confirmation.
5. **Storage may be blocked, full or corrupt.** Every read falls back to a
   default; a storage failure must never break rendering.
6. **Deep links never carry personal data.** See below.

---

## 4. Sharing, deep links and Open Graph

### Deep-link scheme

All paths come from the router tables in `src/routing.ts`
(`workspacePaths`, `accountPaths`), spread into `sharePaths` in `src/share.ts`
so a route rename cannot leave shared links behind.

| Target | Path |
| --- | --- |
| `home` / `shortlist` / `garage` / `community` / `kyv` / `vault` / `analytics` / `creators` | `/`, `/shortlist`, `/garage`, `/community`, `/kyv`, `/vault`, `/analytics`, `/creators` |
| `profile` / `saved` / `following` / `notifications` / `settings` | `/profile`, `/profile/saved`, `/profile/following`, `/profile/notifications`, `/profile/settings` |
| `compose` | `/community/new` |
| `post` | `/community/:postId` |
| `car` | `/cars/:slug` |
| `playbook` | `/playbooks/:slug` |
| `city` | `/cities/:slug` |

`:slug` for cars and playbooks is exactly `insights.modelKeyFor(brand, model)`,
so a link and a notebook always resolve to the same model. City slugs use the
same normalisation with dashes trimmed.

Safety rules built into `buildDeepLink`:

- slugs must match `^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$` and ids
  `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$` — no `.`, `/`, `\`, `%` or whitespace, so
  traversal cannot reach the path;
- `new` is never treated as a post id (it is the composer route);
- bad input **degrades to the parent screen** (`post`/`playbook`/`city` →
  `/community`, `car` → `/shortlist`) instead of emitting a dead URL;
- the only query key allowed is `ref`, and only with the values
  `share | qr | app | email`. Anything else — an email address, a name, a user
  id — is dropped. Deep links carry no personal data, ever.

### Share ladder

`shareOrCopy` runs Web Share (checking `canShare` first) → `navigator.clipboard`
→ `document.execCommand("copy")` → `prompt`. It never throws and it returns a
discriminated `ShareResult` that separates **user cancellation** (`cancelled`)
from **browser refusal** (`failed` / `unsupported`), so the UI stops telling
people "sharing was blocked" when they simply tapped Cancel.
`shareResultMessage(result)` returns the action-bar copy for each branch.

### Per-route Open Graph previews

A static SPA hands every crawler the same `index.html`, so a shared owner note
would always preview as "AutoFlex". Rather than move to SSR, `vercel.json`
rewrites **social crawler user agents only** to `api/og.js`, *before* the SPA
catch-all:

1. `source: "/:path((?!api/|assets/|.*\\..*).*)"` with
   `has: [{ type: "header", key: "user-agent", value: "<social crawler regex>" }]`
   and `missing: [{ type: "query", key: "og" }]` → `/api/og?path=/:path`.
2. The existing SPA rewrite `/((?!assets/|.*\..*).*)` → `/index.html`.

Why this shape:

- **Humans never touch it.** The user-agent allow-list contains only social
  unfurlers (Facebook, Twitter/X, LinkedIn, Slack, Discord, WhatsApp, Telegram,
  Pinterest, Reddit, Apple, Mastodon and friends). Every other request falls
  through to the untouched SPA.
- **Search engines are excluded** — Googlebot, bingbot and the rest match
  nothing in the allow-list, so they index the real app. `api/og.js` also
  re-checks: a search-engine user agent that somehow arrives is *not* given the
  `noindex` header, and gets the clean canonical URL.
- **Static files are excluded** by the `.*\..*` guard, which matters because
  Facebook fetches `/og-cover.png` with the same crawler user agent.
- **No loop.** The shim's meta refresh points at `?og=0`, and the `missing`
  query condition stops the rewrite matching a second time, so a stray human
  lands on the real SPA.
- `Vary: User-Agent` is set both in `vercel.json` and by the function, so shared
  caches never serve a crawler shim to a person.
- The shim contains **no inline script and no inline style** and HTML-escapes
  every interpolated value, so the production CSP applies to it unchanged.

`public/og-cover.png` (1200×630, Obsidian Velocity: surface `#141313`, primary
`#c7c6cb`) is generated by `node scripts/generate-og-image.mjs` — a dependency-
free PNG encoder plus a bitmap font. No external image service is called at
build time or at runtime, and the card is served from our own origin, which
`img-src 'self'` already allows. Re-run the script and commit the PNG whenever
the brand line changes.

---

## 5. Deliberately deferred, with gates

| Deferred item | Why now | Gate that unblocks it |
| --- | --- | --- |
| **Google sign-in** | The lightweight profile flow (local-first, optional account) is the cheapest path to a usable product and avoids an OAuth consent screen before there is anything to consent to. | Build only if the lightweight profile flow proves insufficient: sign-in drop-off or cross-device demand shows up in real tester sessions, not in speculation. |
| **Native Android parity** | The Kotlin/Ktor path is preserved but idle. Splitting effort across two clients before the web loop is validated doubles cost and halves learning. | After the web MVP is validated: the community loop retains real users and the deployed responsive QA pass is clean. |
| **Service-center integration** | Booking, job cards and workshop pricing need a partner's data and commercial terms, not just code. | Awaiting the owning team's contract. No schema or UI is built against a hypothetical partner API. |
| **Real-user tester sessions** | The session kit is written and runnable (`docs/TESTER_SESSIONS.md`); what is missing is people. | Needs recruited participants — daily owners, enthusiasts and active buyers, across multiple cities, on Android and slow connections. |

---

## 6. Where to change what

| Change | File |
| --- | --- |
| A route path | `src/routing.ts` (deep links follow automatically) |
| Deep-link or share behaviour | `src/share.ts` + `src/share.test.ts` |
| Crawler allow-list, rewrites, headers | `vercel.json` |
| Per-route preview copy or enrichment | `api/og.js` |
| Default social card art | `scripts/generate-og-image.mjs` → `public/og-cover.png` |
| Static canonical / default OG tags | `index.html` |

## Verified in production

Checked against https://moto-gp-chi.vercel.app after the 9d516c8 deploy:

- Every workspace and detail route returns 200 (a `cleanUrls` + SPA-fallback
  interaction had been 404ing everything except `/`; `cleanUrls` is now off and
  a regression test guards the combination).
- Security headers intact: CSP with `script-src 'self'` and no `unsafe-inline`,
  HSTS preload, X-Frame-Options DENY, COOP/CORP, Permissions-Policy,
  `Vary: User-Agent`.
- Canonical and og:url point at the indexable production domain. The
  `moto-gp-git-master-…` branch alias carries `x-robots-tag: noindex` and must
  not be shared.
- The crawler OG shim returns route-specific cards, e.g. `/cars/hyundai-creta`
  yields "Hyundai Creta — owner notes and running costs" with its own canonical.
- Service worker registers and serves an offline shell (64 precached URLs).
- 231 tests pass; 72 route x width screenshots show no horizontal overflow and
  no console errors at 360, 390, 768 and 1280px.
