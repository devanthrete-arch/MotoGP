import express from 'express';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Basic hardening headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, '..', 'public')));

export const BRANDS = ['General', 'Maruti Suzuki', 'Tata', 'Mahindra', 'Hyundai', 'Toyota', 'Honda', 'Kia', 'Volkswagen', 'Skoda', 'BMW', 'Mercedes-Benz', 'MG', 'Other'];
export const TOPICS = ['Discussion', 'New Launches', 'DIY & Optimization', 'Ownership Review', 'Tech Talk', 'Troubleshooting', 'Buying Advice'];

const sanitize = (s, max = 20000) => String(s ?? '').slice(0, max);
const pick = (val, list, fallback) => (list.includes(val) ? val : fallback);
// Only accept plain http(s) image URLs — rejects quotes/parens/spaces that could break out of the
// CSS url('...') the client renders it into (CSS-injection guard). Anything else becomes null.
const cleanCover = (c) => {
  const s = sanitize(c ?? '', 2000).trim();
  return /^https?:\/\/[^\s'"()<>]+$/i.test(s) ? s : null;
};

app.get('/api/meta', (_req, res) => res.json({ brands: BRANDS, topics: TOPICS }));

// List posts with filters, search, sort
app.get('/api/posts', (req, res) => {
  const { brand, topic, q, sort } = req.query;
  const where = [];
  const params = {};
  if (brand && brand !== 'All') { where.push('brand = @brand'); params.brand = brand; }
  if (topic && topic !== 'All') { where.push('topic = @topic'); params.topic = topic; }
  if (q) { where.push('(title LIKE @q OR body LIKE @q OR author LIKE @q)'); params.q = `%${q}%`; }
  const order = sort === 'popular' ? 'likes DESC, views DESC, created_at DESC' : 'created_at DESC';
  const sql = `
    SELECT p.id, p.title, p.author, p.brand, p.topic, p.cover, p.views, p.likes, p.created_at, p.updated_at,
           substr(p.body, 1, 280) AS excerpt,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
    FROM posts p
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY ${order} LIMIT 200`;
  res.json(db.prepare(sql).all(params));
});

// Single post (+ increment views) with comments
app.get('/api/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(req.params.id);
  post.views += 1;
  delete post.edit_token;
  post.comments = db.prepare('SELECT id, author, body, created_at FROM comments WHERE post_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(post);
});

// Create post -> returns edit_token for ownership
app.post('/api/posts', (req, res) => {
  const { title, body, author, brand, topic, cover } = req.body || {};
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'Title and body are required' });
  const token = crypto.randomBytes(24).toString('hex');
  const info = db.prepare(`
    INSERT INTO posts (title, body, author, brand, topic, cover, edit_token)
    VALUES (@title, @body, @author, @brand, @topic, @cover, @token)
  `).run({
    title: sanitize(title, 200),
    body: sanitize(body),
    author: sanitize(author, 60) || 'Anonymous',
    brand: pick(brand, BRANDS, 'General'),
    topic: pick(topic, TOPICS, 'Discussion'),
    cover: cleanCover(cover),
    token,
  });
  res.status(201).json({ id: info.lastInsertRowid, edit_token: token });
});

const ownsPost = (id, token) => {
  const row = db.prepare('SELECT edit_token FROM posts WHERE id = ?').get(id);
  return row && token && row.edit_token === token;
};

// Edit own post
app.put('/api/posts/:id', (req, res) => {
  const { edit_token, title, body, author, brand, topic, cover } = req.body || {};
  if (!ownsPost(req.params.id, edit_token)) return res.status(403).json({ error: 'You can only edit your own post' });
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'Title and body are required' });
  db.prepare(`
    UPDATE posts SET title=@title, body=@body, author=@author, brand=@brand, topic=@topic, cover=@cover,
    updated_at=datetime('now') WHERE id=@id
  `).run({
    id: req.params.id,
    title: sanitize(title, 200),
    body: sanitize(body),
    author: sanitize(author, 60) || 'Anonymous',
    brand: pick(brand, BRANDS, 'General'),
    topic: pick(topic, TOPICS, 'Discussion'),
    cover: cleanCover(cover),
  });
  res.json({ ok: true });
});

// Delete own post
app.delete('/api/posts/:id', (req, res) => {
  const token = req.body?.edit_token || req.query.edit_token;
  if (!ownsPost(req.params.id, token)) return res.status(403).json({ error: 'You can only delete your own post' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Like a post
app.post('/api/posts/:id/like', (req, res) => {
  const info = db.prepare('UPDATE posts SET likes = likes + 1 WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Post not found' });
  res.json({ likes: db.prepare('SELECT likes FROM posts WHERE id = ?').get(req.params.id).likes });
});

// Add comment
app.post('/api/posts/:id/comments', (req, res) => {
  const { author, body } = req.body || {};
  if (!body?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const info = db.prepare('INSERT INTO comments (post_id, author, body) VALUES (?, ?, ?)')
    .run(req.params.id, sanitize(author, 60) || 'Anonymous', sanitize(body, 5000));
  res.status(201).json(db.prepare('SELECT id, author, body, created_at FROM comments WHERE id = ?').get(info.lastInsertRowid));
});

app.get('/api/stats', (_req, res) => {
  res.json({
    posts: db.prepare('SELECT COUNT(*) n FROM posts').get().n,
    comments: db.prepare('SELECT COUNT(*) n FROM comments').get().n,
  });
});

app.listen(PORT, () => console.log(`Autoflex running at http://localhost:${PORT}`));
