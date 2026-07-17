# Autoflex 🏁

A full-ownership blog & discussion forum for New Age car enthusiasts — inspired by TeamBHP.
Write freely about how your car works, what to fix, what to buy, and what just launched.

## Features
- **Full ownership** — create, edit, and delete your own posts (pseudonymous, no passwords). Ownership is held via a per-post token stored in your browser.
- **Rich posts** — title, markdown-lite body, author, brand tag, topic tag, optional cover image.
- **Discussion** — threaded comments on every post.
- **Likes, views, search, filters** — sort by latest/popular, filter by brand & topic, full-text search.

## Stack
- Backend: Node + Express + better-sqlite3 (real persistence in `data/autoflex.db`)
- Frontend: server-static vanilla JS SPA (no build step)

## Run
```bash
npm install
node server/seed.js   # optional: seed 3 example posts
npm start             # http://localhost:3000
```

## API
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/posts` | list (`?brand=&topic=&q=&sort=latest\|popular`) |
| GET | `/api/posts/:id` | single post + comments (increments views) |
| POST | `/api/posts` | create → returns `edit_token` |
| PUT | `/api/posts/:id` | edit (requires `edit_token`) |
| DELETE | `/api/posts/:id` | delete (requires `edit_token`) |
| POST | `/api/posts/:id/like` | like |
| POST | `/api/posts/:id/comments` | add comment |
| GET | `/api/meta` `/api/stats` | brands/topics, counts |
