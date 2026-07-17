// ---------- tiny helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const api = async (url, opts) => {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const timeAgo = (iso) => {
  const d = (Date.now() - new Date(iso + 'Z').getTime()) / 1000;
  const u = [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [s, l] of u) if (d >= s) return Math.floor(d / s) + l + ' ago';
  return 'just now';
};
const toast = (msg) => {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 2600);
};

// markdown-lite -> safe html (line-aware: mixed headings/lists/paragraphs in one block are all preserved)
function mdLite(src) {
  const lines = esc(src).split('\n');
  let html = '', para = [], list = [];
  const flushPara = () => { if (para.length) { html += `<p>${para.join('<br>')}</p>`; para = []; } };
  const flushList = () => { if (list.length) { html += '<ul>' + list.map(i => `<li>${i}</li>`).join('') + '</ul>'; list = []; } };
  const flush = () => { flushPara(); flushList(); };
  for (const raw of lines) {
    const l = raw.trim();
    if (l === '') { flush(); continue; }
    if (/^###\s/.test(l)) { flush(); html += `<h3>${inline(l.replace(/^###\s/, ''))}</h3>`; }
    else if (/^##\s/.test(l)) { flush(); html += `<h2>${inline(l.replace(/^##\s/, ''))}</h2>`; }
    else if (/^#\s/.test(l)) { flush(); html += `<h1>${inline(l.replace(/^#\s/, ''))}</h1>`; }
    else if (/^(-|\*)\s/.test(l)) { flushPara(); list.push(inline(l.replace(/^(-|\*)\s/, ''))); }
    else { flushList(); para.push(inline(l)); }
  }
  flush();
  return html;
}
const inline = (s) => s
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/`(.+?)`/g, '<code>$1</code>');

// ---------- ownership store ----------
const TOKENS = {
  get: (id) => JSON.parse(localStorage.getItem('autoflex_tokens') || '{}')[id],
  set: (id, tok) => { const m = JSON.parse(localStorage.getItem('autoflex_tokens') || '{}'); m[id] = tok; localStorage.setItem('autoflex_tokens', JSON.stringify(m)); },
  del: (id) => { const m = JSON.parse(localStorage.getItem('autoflex_tokens') || '{}'); delete m[id]; localStorage.setItem('autoflex_tokens', JSON.stringify(m)); },
};

// ---------- state ----------
let META = { brands: [], topics: [] };
const filters = { brand: 'All', topic: 'All', sort: 'latest', q: '' };

// ---------- filters UI ----------
function buildFilters() {
  const bc = $('#brand-chips'), tc = $('#topic-chips');
  const mk = (label, val, key) => `<button class="chip${filters[key] === val ? ' active' : ''}" data-${key}="${esc(val)}">${esc(label)}</button>`;
  bc.innerHTML = mk('All', 'All', 'brand') + META.brands.map(b => mk(b, b, 'brand')).join('');
  tc.innerHTML = mk('All', 'All', 'topic') + META.topics.map(t => mk(t, t, 'topic')).join('');
}
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  for (const key of ['brand', 'topic', 'sort']) if (chip.dataset[key] !== undefined) {
    filters[key] = chip.dataset[key];
    document.querySelectorAll(`[data-${key}]`).forEach(c => c.classList.toggle('active', c === chip));
    if (location.hash.startsWith('#/post/')) location.hash = '#/';
    else renderList();
  }
});

// ---------- list view ----------
async function renderList() {
  $('#hero').style.display = '';
  const view = $('#view');
  const params = new URLSearchParams();
  if (filters.brand !== 'All') params.set('brand', filters.brand);
  if (filters.topic !== 'All') params.set('topic', filters.topic);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.q) params.set('q', filters.q);
  view.innerHTML = '<div class="empty">Loading…</div>';
  const posts = await api('/api/posts?' + params);
  if (!posts.length) { view.innerHTML = `<div class="empty">No posts yet. Be the first to <b>Write a Post</b>.</div>`; return; }
  view.innerHTML = '<div class="card-grid">' + posts.map(cardHTML).join('') + '</div>';
}
function cardHTML(p) {
  const cover = p.cover ? `<div class="cover" style="background-image:url('${esc(p.cover)}')"></div>` : '';
  return `<article class="card" onclick="location.hash='#/post/${p.id}'">
    ${cover}
    <div class="body">
      <div class="tags"><span class="tag">${esc(p.brand)}</span><span class="tag topic">${esc(p.topic)}</span></div>
      <h2>${esc(p.title)}</h2>
      <p class="excerpt">${esc(p.excerpt)}${p.excerpt.length >= 280 ? '…' : ''}</p>
      <div class="meta">
        <span class="who">${esc(p.author)}</span>
        <span>${timeAgo(p.created_at)}</span>
        <span>♥ ${p.likes}</span>
        <span>💬 ${p.comment_count}</span>
        <span>👁 ${p.views}</span>
      </div>
    </div>
  </article>`;
}

// ---------- detail view ----------
async function renderPost(id) {
  $('#hero').style.display = 'none';
  const view = $('#view');
  view.innerHTML = '<div class="empty">Loading…</div>';
  let p;
  try { p = await api('/api/posts/' + id); }
  catch { view.innerHTML = '<div class="empty">Post not found. <a href="#/">Go home</a></div>'; return; }
  const owned = !!TOKENS.get(id);
  const cover = p.cover ? `<div class="cover-lg" style="background-image:url('${esc(p.cover)}')"></div>` : '';
  view.innerHTML = `<article class="post-detail">
    ${cover}
    <div class="inner">
      <a class="back-link" href="#/">← All posts</a>
      <div class="tags"><span class="tag">${esc(p.brand)}</span><span class="tag topic">${esc(p.topic)}</span></div>
      <h1>${esc(p.title)}</h1>
      <div class="meta card"><span class="who" style="padding:0;border:0;background:none">By ${esc(p.author)}</span> · ${timeAgo(p.created_at)} · 👁 ${p.views}${p.updated_at !== p.created_at ? ' · edited' : ''}</div>
      <div class="post-actions">
        <button class="btn primary small" id="like-btn">♥ Like (${p.likes})</button>
        <span style="color:var(--muted);font-size:13px">💬 ${p.comments.length} comments</span>
        ${owned ? `<div class="owner-tools"><button class="btn ghost small" id="edit-btn">Edit</button><button class="btn ghost small" id="del-btn">Delete</button></div>` : ''}
      </div>
      <div class="post-body">${mdLite(p.body)}</div>
      <div class="comments">
        <h3>Discussion (${p.comments.length})</h3>
        <div id="comment-list">${p.comments.map(commentHTML).join('') || '<p style="color:var(--muted)">No comments yet — start the conversation.</p>'}</div>
        <form class="comment-form" id="comment-form">
          <input id="c-author" maxlength="60" placeholder="Your name (optional)" />
          <textarea id="c-body" rows="3" required placeholder="Add to the discussion…"></textarea>
          <div><button class="btn primary" type="submit">Post Comment</button></div>
        </form>
      </div>
    </div>
  </article>`;

  $('#like-btn').onclick = async () => {
    const { likes } = await api(`/api/posts/${id}/like`, { method: 'POST' });
    $('#like-btn').textContent = `♥ Like (${likes})`;
  };
  $('#comment-form').onsubmit = async (e) => {
    e.preventDefault();
    const c = await api(`/api/posts/${id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: $('#c-author').value, body: $('#c-body').value }),
    });
    const list = $('#comment-list');
    if (list.querySelector('p')) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', commentHTML(c));
    $('#c-body').value = '';
    toast('Comment posted');
  };
  if (owned) {
    $('#edit-btn').onclick = () => openEditor(p);
    $('#del-btn').onclick = async () => {
      if (!confirm('Delete this post permanently?')) return;
      await api('/api/posts/' + id, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edit_token: TOKENS.get(id) }),
      });
      TOKENS.del(id); toast('Post deleted'); location.hash = '#/';
    };
  }
}
const commentHTML = (c) => `<div class="comment"><span class="who">${esc(c.author)}</span> <span class="when">· ${timeAgo(c.created_at)}</span><p>${esc(c.body).replace(/\n/g, '<br>')}</p></div>`;

// ---------- editor modal ----------
function fillSelect(el, list) { el.innerHTML = list.map(v => `<option>${esc(v)}</option>`).join(''); }
function openEditor(post = null) {
  fillSelect($('#f-brand'), META.brands);
  fillSelect($('#f-topic'), META.topics);
  $('#modal-title').textContent = post ? 'Edit Post' : 'Write a Post';
  $('#submit-btn').textContent = post ? 'Save Changes' : 'Publish';
  $('#f-id').value = post?.id || '';
  $('#f-title').value = post?.title || '';
  $('#f-author').value = post?.author || '';
  $('#f-brand').value = post?.brand || 'General';
  $('#f-topic').value = post?.topic || 'Discussion';
  $('#f-cover').value = post?.cover || '';
  $('#f-body').value = post?.body || '';
  $('#form-err').textContent = '';
  $('#modal').hidden = false;
}
const closeModal = () => ($('#modal').hidden = true);

$('#post-form').onsubmit = async (e) => {
  e.preventDefault();
  const id = $('#f-id').value;
  const payload = {
    title: $('#f-title').value, author: $('#f-author').value, brand: $('#f-brand').value,
    topic: $('#f-topic').value, cover: $('#f-cover').value, body: $('#f-body').value,
  };
  try {
    if (id) {
      payload.edit_token = TOKENS.get(id);
      await api('/api/posts/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      closeModal(); toast('Post updated'); renderPost(id);
    } else {
      const { id: newId, edit_token } = await api('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      TOKENS.set(newId, edit_token);
      closeModal(); toast('Published! You own this post.'); location.hash = '#/post/' + newId;
    }
  } catch (err) { $('#form-err').textContent = err.message; }
};

// ---------- wiring ----------
$('#new-post-btn').onclick = () => openEditor();
$('#modal-close').onclick = closeModal;
$('#cancel-btn').onclick = closeModal;
$('#modal').onclick = (e) => { if (e.target === $('#modal')) closeModal(); };
let searchT;
$('#search').oninput = (e) => { clearTimeout(searchT); searchT = setTimeout(() => { filters.q = e.target.value.trim(); if (location.hash.startsWith('#/post/')) location.hash = '#/'; else renderList(); }, 250); };

async function loadStats() {
  try {
    const s = await api('/api/stats');
    $('#stats').innerHTML = `<div><b>${s.posts}</b><span>posts</span></div><div><b>${s.comments}</b><span>comments</span></div>`;
  } catch {}
}
function route() {
  const m = location.hash.match(/^#\/post\/(\d+)/);
  if (m) renderPost(m[1]); else { renderList(); loadStats(); }
}
window.addEventListener('hashchange', route);

(async function init() {
  META = await api('/api/meta');
  buildFilters();
  route();
})();
