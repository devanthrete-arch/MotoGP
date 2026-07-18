const api = {
  meta: () => getJson("/api/meta"),
  stats: () => getJson("/api/stats"),
  models: () => getJson("/api/models"),
  posts: params => getJson(`/api/posts?${new URLSearchParams(params)}`),
  savedPosts: params => getJson(`/api/saved-posts?${new URLSearchParams(params)}`),
  createProfile: body => sendJson("/api/profiles", "POST", body),
  recoverProfile: body => sendJson("/api/profiles/recover", "POST", body),
  deleteProfile: save_token => sendJson("/api/profiles", "DELETE", { save_token }),
  upload: file => uploadImage(file),
  post: (id, profile_token) => getJson(`/api/posts/${id}?${new URLSearchParams({ profile_token: profile_token || "" })}`),
  create: body => sendJson("/api/posts", "POST", body),
  update: (id, body) => sendJson(`/api/posts/${id}`, "PUT", body),
  delete: (id, edit_token, profile_token) => sendJson(`/api/posts/${id}`, "DELETE", { edit_token, profile_token }),
  like: id => sendJson(`/api/posts/${id}/like`, "POST", {}),
  confirmFix: (id, actor_token) => sendJson(`/api/posts/${id}/fix-confirmation`, "PUT", { actor_token }),
  helpful: (id, actor_token) => sendJson(`/api/posts/${id}/helpful`, "PUT", { actor_token }),
  stale: (id, actor_token) => sendJson(`/api/posts/${id}/stale`, "PUT", { actor_token }),
  save: (id, save_token) => sendJson(`/api/posts/${id}/save`, "PUT", { save_token }),
  unsave: (id, save_token) => sendJson(`/api/posts/${id}/save`, "DELETE", { save_token }),
  comment: (id, body) => sendJson(`/api/posts/${id}/comments`, "POST", body),
  report: (id, body) => sendJson(`/api/posts/${id}/reports`, "POST", body),
  feedback: body => sendJson("/api/feedback", "POST", body),
};

const state = {
  meta: { brands: [], topics: [] },
  posts: [],
  models: [],
  modelPosts: [],
  selected: null,
  editing: null,
  modelFilter: null,
  hasMore: false,
  offset: 0,
  limit: 20,
  mode: "all",
  saved: new Set(JSON.parse(localStorage.getItem("autoflex.saved.ids") || "[]")),
  saveToken: localStorage.getItem("autoflex.save.token") || createSaveToken(),
  profile: JSON.parse(localStorage.getItem("autoflex.profile") || "null"),
};

const els = {
  stats: document.querySelector("#stats"),
  feed: document.querySelector("#feed"),
  feedView: document.querySelector("#feed-view"),
  postView: document.querySelector("#post-view"),
  modelsView: document.querySelector("#models-view"),
  modelsList: document.querySelector("#models-list"),
  loadMore: document.querySelector("#load-more"),
  allPostsMode: document.querySelector("#all-posts-mode"),
  savedPostsMode: document.querySelector("#saved-posts-mode"),
  search: document.querySelector("#search"),
  sort: document.querySelector("#sort"),
  topic: document.querySelector("#topic"),
  brandFilter: document.querySelector("#brand-filter"),
  newPost: document.querySelector("#new-post"),
  modelsButton: document.querySelector("#models-button"),
  rulesButton: document.querySelector("#rules-button"),
  feedbackButton: document.querySelector("#feedback-button"),
  rulesDialog: document.querySelector("#rules-dialog"),
  feedbackDialog: document.querySelector("#feedback-dialog"),
  feedbackForm: document.querySelector("#feedback-form"),
  feedbackName: document.querySelector("#feedback-name"),
  feedbackMessage: document.querySelector("#feedback-message"),
  profileButton: document.querySelector("#profile-button"),
  profileDialog: document.querySelector("#profile-dialog"),
  profileForm: document.querySelector("#profile-form"),
  profileStatus: document.querySelector("#profile-status"),
  profileName: document.querySelector("#profile-name"),
  recoveryCode: document.querySelector("#recovery-code"),
  recoverProfile: document.querySelector("#recover-profile"),
  deleteProfile: document.querySelector("#delete-profile"),
  editor: document.querySelector("#editor"),
  editorForm: document.querySelector("#editor-form"),
  editorTitle: document.querySelector("#editor-title"),
  title: document.querySelector("#post-title"),
  author: document.querySelector("#post-author"),
  postBrand: document.querySelector("#post-brand"),
  postTopic: document.querySelector("#post-topic"),
  postLabel: document.querySelector("#post-label"),
  postModel: document.querySelector("#post-model"),
  postVariant: document.querySelector("#post-variant"),
  postCity: document.querySelector("#post-city"),
  postOdometer: document.querySelector("#post-odometer"),
  coverFile: document.querySelector("#post-cover-file"),
  cover: document.querySelector("#post-cover"),
  body: document.querySelector("#post-body"),
  reportDialog: document.querySelector("#report-dialog"),
  reportForm: document.querySelector("#report-form"),
  reporter: document.querySelector("#reporter"),
  reportReason: document.querySelector("#report-reason"),
  toast: document.querySelector("#toast"),
};

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("error", event => captureClientError(event.message, event.filename, event.error?.stack));
window.addEventListener("unhandledrejection", event => {
  const reason = event.reason;
  captureClientError(reason?.message || String(reason || "Unhandled promise rejection"), "promise", reason?.stack || "");
});

async function init() {
  bindEvents();
  if (state.profile) els.profileButton.textContent = state.profile.displayName;
  try {
    const [meta, stats] = await Promise.all([api.meta(), api.stats()]);
    state.meta = meta;
    fillSelect(els.topic, ["All", ...meta.topics]);
    fillSelect(els.brandFilter, ["All", ...meta.brands]);
    fillSelect(els.postBrand, meta.brands);
    fillSelect(els.postTopic, meta.topics);
    fillSelect(els.postLabel, meta.knowledge_labels || ["Owner note"]);
    els.stats.textContent = `${stats.posts} posts and ${stats.comments} comments`;
    await loadFeed(true);
  } catch (error) {
    showToast(error.message);
  }
}

function bindEvents() {
  els.search.addEventListener("input", debounce(() => loadFeed(true), 250));
  [els.sort, els.topic, els.brandFilter].forEach(el => el.addEventListener("change", () => {
    state.modelFilter = null;
    loadFeed(true);
  }));
  els.loadMore.addEventListener("click", () => loadFeed(false));
  els.allPostsMode.addEventListener("click", () => setMode("all"));
  els.savedPostsMode.addEventListener("click", () => setMode("saved"));
  els.newPost.addEventListener("click", () => openEditor());
  els.modelsButton.addEventListener("click", showModels);
  els.rulesButton.addEventListener("click", openRules);
  els.feedbackButton.addEventListener("click", openFeedback);
  document.querySelector("[data-close-rules]").addEventListener("click", () => els.rulesDialog.close());
  document.querySelector("[data-close-feedback]").addEventListener("click", () => els.feedbackDialog.close());
  document.querySelectorAll("[data-open-rules]").forEach(el => el.addEventListener("click", openRules));
  els.profileButton.addEventListener("click", openProfile);
  document.querySelector("[data-close-profile]").addEventListener("click", () => els.profileDialog.close());
  els.profileForm.addEventListener("submit", saveProfile);
  els.recoverProfile.addEventListener("click", recoverProfile);
  els.deleteProfile.addEventListener("click", deleteProfile);
  document.querySelector("[data-close-editor]").addEventListener("click", () => els.editor.close());
  document.querySelector("[data-close-report]").addEventListener("click", () => els.reportDialog.close());
  els.editorForm.addEventListener("submit", savePost);
  els.reportForm.addEventListener("submit", saveReport);
  els.feedbackForm.addEventListener("submit", saveFeedback);
  window.addEventListener("popstate", () => {
    if (location.hash.startsWith("#post-")) openPost(Number(location.hash.replace("#post-", "")), false);
    else if (location.hash.startsWith("#model-")) openModel(hashModel(), false);
    else if (location.hash === "#models") showModels(false);
    else showFeed(false);
  });
}

async function loadFeed(reset) {
  if (reset) {
    state.offset = 0;
    state.posts = [];
    els.feed.replaceChildren(empty("Loading posts..."));
  }
  els.loadMore.disabled = true;
  const params = {
    limit: state.limit,
    offset: state.offset,
  };
  const response = state.mode === "saved"
    ? await api.savedPosts({ ...params, save_token: state.saveToken })
    : await api.posts({
        ...params,
        q: els.search.value.trim(),
        sort: els.sort.value,
        topic: els.topic.value,
        brand: els.brandFilter.value,
        model: state.modelFilter?.model || "",
      });
  state.posts = reset ? response.posts : [...state.posts, ...response.posts];
  state.offset = state.posts.length;
  state.hasMore = response.has_more;
  renderFeed();
}

function renderFeed() {
  els.feed.replaceChildren();
  els.loadMore.classList.toggle("hidden", !state.hasMore);
  els.loadMore.disabled = false;

  if (!state.posts.length) {
    els.feed.append(feedEmptyState());
    return;
  }

  state.posts.forEach(post => {
    const card = div("post-card");
    const open = div("post-main");
    const openButton = button("primary", "Open");
    open.tabIndex = 0;
    open.setAttribute("role", "button");
    open.addEventListener("click", () => openPost(post.id, true));
    open.addEventListener("keydown", event => {
      if (event.key === "Enter") openPost(post.id, true);
    });
    open.append(tags(post.brand, post.knowledge_label || post.topic), h("h3", post.title), qualityProof(post), p(modelDetails(post), "muted"), p(excerpt(post.excerpt)), meta(post));
    openButton.addEventListener("click", event => {
      event.stopPropagation();
      openPost(post.id, true);
    });
    open.append(saveRow(post, openButton));
    card.append(open);
    if (post.cover) card.append(image(post.cover, "cover"));
    els.feed.append(card);
  });
}

async function openPost(id, push) {
  try {
    const post = await api.post(id, actorToken());
    state.selected = post;
    if (push) history.pushState(null, "", `#post-${id}`);
    renderPost(post);
  } catch (error) {
    showToast(error.message);
  }
}

function renderPost(post) {
  els.feedView.classList.add("hidden");
  els.postView.classList.remove("hidden");
  els.modelsView.classList.add("hidden");
  els.postView.replaceChildren();

  const detail = div("detail");
  if (post.cover) detail.append(image(post.cover, "detail-cover"));
  const body = div("detail-body");
  body.append(
    tags(post.brand, post.knowledge_label || post.topic),
    h("h1", post.title),
    facts(post),
    fixProof(post),
    qualityProof(post),
    p(`By ${post.author} | ${timeAgo(post.created_at)} | ${post.views} views`, "muted"),
    actionBar(post),
    p(post.body, "body-text"),
    h("h2", `Discussion (${post.comments.length})`),
    comments(post),
    commentForm(post.id),
  );
  detail.append(body);
  els.postView.append(detail);
}

function actionBar(post) {
  const actions = div("actions");
  const back = button("secondary", "Back");
  const like = button("primary", `Like (${post.likes})`);
  const report = button("secondary", "Report");
  const save = button("secondary", state.saved.has(post.id) ? "Saved" : "Save");
  const share = button("secondary", "Share");
  const worked = button("secondary", "Worked for me");
  const helpful = button("secondary", `Helpful (${post.helpful_count || 0})`);
  const stale = button("secondary", `Stale info (${post.stale_count || 0})`);
  back.addEventListener("click", () => showFeed(true));
  like.addEventListener("click", async () => {
    const response = await api.like(post.id);
    state.selected.likes = response.likes;
    renderPost(state.selected);
  });
  save.addEventListener("click", () => toggleSave(post.id));
  share.addEventListener("click", () => sharePost(post));
  helpful.addEventListener("click", () => markQuality(post, "helpful"));
  stale.addEventListener("click", () => markQuality(post, "stale"));
  report.addEventListener("click", () => els.reportDialog.showModal());
  actions.append(back, like, helpful, stale, save, share, report);
  if (post.knowledge_label === "Fix") {
    worked.addEventListener("click", () => confirmFix(post));
    actions.append(worked);
  }

  const token = localStorage.getItem(tokenKey(post.id));
  if (token || post.can_edit) {
    const edit = button("secondary", "Edit");
    const remove = button("danger", "Delete");
    edit.addEventListener("click", () => openEditor(post));
    remove.addEventListener("click", () => deletePost(post.id, token));
    actions.append(edit, remove);
  }
  return actions;
}

function saveRow(post, openButton) {
  const row = div("actions");
  const save = button("secondary", state.saved.has(post.id) ? "Saved" : "Save");
  const share = button("secondary", "Share");
  save.type = "button";
  save.addEventListener("click", event => {
    event.stopPropagation();
    toggleSave(post.id);
  });
  share.addEventListener("click", event => {
    event.stopPropagation();
    sharePost(post);
  });
  row.append(openButton, save, share);
  return row;
}

async function toggleSave(id) {
  try {
    if (state.saved.has(id)) {
      await api.unsave(id, state.saveToken);
      state.saved.delete(id);
      showToast("Removed from saved posts.");
    } else {
      await api.save(id, state.saveToken);
      state.saved.add(id);
      showToast("Saved for later.");
    }
    persistSaved();
    if (state.selected?.id === id) renderPost({ ...state.selected });
    renderFeed();
  } catch (error) {
    showToast(error.message);
  }
}

function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  state.modelFilter = null;
  els.allPostsMode.classList.toggle("active", mode === "all");
  els.savedPostsMode.classList.toggle("active", mode === "saved");
  [els.search, els.sort, els.topic, els.brandFilter].forEach(el => {
    el.disabled = mode === "saved";
  });
  loadFeed(true);
}

function comments(post) {
  const list = div("comments");
  if (!post.comments.length) list.append(p("No comments yet.", "muted"));
  post.comments.forEach(comment => {
    const item = div("comment");
    item.append(p(`${comment.author} | ${timeAgo(comment.created_at)}`, "muted"), p(comment.body));
    list.append(item);
  });
  return list;
}

function commentForm(postId) {
  const form = document.createElement("form");
  form.className = "comment-form";
  const author = input("Your name (optional)");
  author.input.value = state.profile?.displayName || "";
  const body = textarea("Add to the discussion", 4);
  const submit = button("primary", "Post comment");
  form.append(author.wrap, body.wrap, submit);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!body.input.value.trim()) return;
    await api.comment(postId, {
      author: author.input.value.trim(),
      body: body.input.value.trim(),
      actor_token: actorToken(),
    });
    await openPost(postId, false);
  });
  return form;
}

function openEditor(post) {
  state.editing = post || null;
  els.editorTitle.textContent = post ? "Edit post" : "Write a post";
  els.title.value = post?.title || "";
  els.author.value = post?.author || state.profile?.displayName || "";
  els.postBrand.value = post?.brand || state.modelFilter?.brand || state.meta.brands[0] || "General";
  els.postTopic.value = post?.topic || state.meta.topics[0] || "Discussion";
  els.postLabel.value = post?.knowledge_label || "Owner note";
  els.postModel.value = post?.model || state.modelFilter?.model || "";
  els.postVariant.value = post?.variant || "";
  els.postCity.value = post?.city || "";
  els.postOdometer.value = post?.odometer_km || "";
  els.coverFile.value = "";
  els.cover.value = post?.cover || "";
  els.body.value = post?.body || "";
  els.editor.showModal();
}

function openRules() {
  els.rulesDialog.showModal();
}

function openFeedback() {
  els.feedbackName.value = state.profile?.displayName || "";
  els.feedbackMessage.value = "";
  els.feedbackDialog.showModal();
}

async function savePost(event) {
  event.preventDefault();
  let cover = els.cover.value.trim();
  const draft = {
    title: els.title.value.trim(),
    author: els.author.value.trim(),
    brand: els.postBrand.value,
    topic: els.postTopic.value,
    knowledge_label: els.postLabel.value,
    model: els.postModel.value.trim(),
    variant: els.postVariant.value.trim(),
    city: els.postCity.value.trim(),
    odometer_km: Number(els.postOdometer.value) || null,
    cover,
    body: els.body.value.trim(),
  };
  if (!draft.title || !draft.body) return;
  if (els.coverFile.files[0]?.size > 4 * 1024 * 1024) {
    showToast("Choose an image under 4 MB.");
    return;
  }

  try {
    if (els.coverFile.files[0]) {
      showToast("Uploading cover image...");
      cover = (await api.upload(els.coverFile.files[0])).url;
      draft.cover = cover;
    }
    if (state.editing) {
      await api.update(state.editing.id, {
        ...draft,
        edit_token: localStorage.getItem(tokenKey(state.editing.id)) || "",
        profile_token: actorToken(),
        actor_token: actorToken(),
      });
      els.editor.close();
      await openPost(state.editing.id, false);
    } else {
      const created = await api.create({ ...draft, profile_token: actorToken(), actor_token: actorToken() });
      localStorage.setItem(tokenKey(created.id), created.edit_token);
      els.editor.close();
      await loadFeed(true);
      await openPost(created.id, true);
    }
  } catch (error) {
    showToast(error.message);
  }
}

async function saveReport(event) {
  event.preventDefault();
  if (!state.selected || !els.reportReason.value.trim()) return;
  try {
    await api.report(state.selected.id, {
      reporter: els.reporter.value.trim() || state.profile?.displayName || "",
      reason: els.reportReason.value.trim(),
      actor_token: actorToken(),
    });
    els.reporter.value = "";
    els.reportReason.value = "";
    els.reportDialog.close();
    showToast("Thanks. This report is saved for moderation.");
  } catch (error) {
    showToast(error.message);
  }
}

async function saveFeedback(event) {
  event.preventDefault();
  if (!els.feedbackMessage.value.trim()) return;
  try {
    await api.feedback({
      name: els.feedbackName.value.trim() || state.profile?.displayName || "",
      message: els.feedbackMessage.value.trim(),
      context: location.hash || location.pathname,
      actor_token: actorToken(),
    });
    els.feedbackDialog.close();
    showToast("Feedback saved. We’ll use it for the next build pass.");
  } catch (error) {
    showToast(error.message);
  }
}

function openProfile() {
  els.profileName.value = state.profile?.displayName || "";
  els.recoveryCode.value = "";
  els.profileStatus.textContent = state.profile
    ? `Signed in as ${state.profile.displayName}. Keep your recovery code safe.`
    : "Create a lightweight profile to recover your saved posts on another browser.";
  els.deleteProfile.disabled = !state.profile;
  els.profileDialog.showModal();
}

async function saveProfile(event) {
  event.preventDefault();
  const displayName = els.profileName.value.trim();
  if (!displayName) return;
  try {
    const profile = await api.createProfile({ display_name: displayName, save_token: state.saveToken });
    applyProfile(profile);
    els.profileStatus.textContent = `Profile saved. Recovery code: ${profile.recovery_code}`;
    showToast("Profile saved. Store the recovery code somewhere safe.");
  } catch (error) {
    showToast(error.message);
  }
}

async function recoverProfile() {
  const recoveryCode = els.recoveryCode.value.trim();
  if (!recoveryCode) return;
  try {
    const profile = await api.recoverProfile({ recovery_code: recoveryCode });
    applyProfile(profile);
    els.profileName.value = profile.display_name;
    els.profileStatus.textContent = `Recovered ${profile.display_name}.`;
    await loadFeed(true);
    showToast("Profile recovered.");
  } catch (error) {
    showToast(error.message);
  }
}

function applyProfile(profile) {
  state.profile = { displayName: profile.display_name, profileToken: profile.profile_token };
  state.saveToken = profile.profile_token;
  localStorage.setItem("autoflex.profile", JSON.stringify(state.profile));
  localStorage.setItem("autoflex.save.token", state.saveToken);
  els.profileButton.textContent = state.profile.displayName;
  els.deleteProfile.disabled = false;
}

async function deleteProfile() {
  if (!state.profile || !confirm("Delete this profile, its saved posts, and posts created under this profile?")) return;
  try {
    await api.deleteProfile(state.saveToken);
    state.profile = null;
    state.saved.clear();
    localStorage.removeItem("autoflex.profile");
    localStorage.removeItem("autoflex.saved.ids");
    localStorage.removeItem("autoflex.save.token");
    state.saveToken = createSaveToken();
    els.profileButton.textContent = "Profile";
    els.profileDialog.close();
    await loadFeed(true);
    showToast("Profile deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deletePost(id, token) {
  if (!confirm("Delete this post and its comments?")) return;
  await api.delete(id, token || "", actorToken());
  localStorage.removeItem(tokenKey(id));
  showFeed(true);
  await loadFeed(true);
}

function showFeed(push) {
  els.postView.classList.add("hidden");
  els.modelsView.classList.add("hidden");
  els.feedView.classList.remove("hidden");
  if (push) history.pushState(null, "", location.pathname);
}

async function showModels(push = true) {
  try {
    els.feedView.classList.add("hidden");
    els.postView.classList.add("hidden");
    els.modelsView.classList.remove("hidden");
    els.modelsList.replaceChildren(empty("Loading model notes..."));
    const response = await api.models();
    state.models = response.models;
    renderModels();
    if (push) history.pushState(null, "", "#models");
  } catch (error) {
    showToast(error.message);
  }
}

function renderModels() {
  els.modelsList.replaceChildren();
  if (!state.models.length) {
    const box = empty("No model notebooks yet. Add a model name while writing an ownership post.");
    const actions = div("actions");
    const write = button("primary", "Write first model note");
    write.addEventListener("click", () => openEditor());
    actions.append(write);
    box.append(actions);
    els.modelsList.append(box);
    return;
  }
  state.models.forEach(model => {
    const card = div("model-card");
    const open = button("secondary wide", "Open notebook");
    const share = button("secondary wide", "Share notebook");
    open.addEventListener("click", () => openModel(model));
    share.addEventListener("click", () => shareModel(model));
    card.append(
      tags(model.brand, `${model.post_count} posts`),
      h("h3", model.model),
      modelStats(model),
      p(`Latest owner note ${timeAgo(model.latest_post_at)}.`, "meta"),
      open,
      share,
    );
    els.modelsList.append(card);
  });
}

async function openModel(model) {
  if (!model) return showModels(false);
  try {
    els.feedView.classList.add("hidden");
    els.postView.classList.add("hidden");
    els.modelsView.classList.remove("hidden");
    els.modelsList.replaceChildren(empty(`Loading ${model.model} notebook...`));
    const response = await api.posts({
      brand: model.brand,
      model: model.model,
      sort: "latest",
      limit: 50,
      offset: 0,
    });
    state.modelFilter = model;
    state.modelPosts = response.posts;
    renderModelNotebook(model, response.posts);
    if (arguments.length < 2 || arguments[1]) history.pushState(null, "", modelHash(model));
  } catch (error) {
    showToast(error.message);
  }
}

function renderModelNotebook(model, posts) {
  const hero = div("model-hero");
  const back = button("secondary", "Back to models");
  const write = button("primary", `Write about ${model.model}`);
  const share = button("secondary", "Share notebook");
  back.addEventListener("click", () => showModels(true));
  share.addEventListener("click", () => shareModel(model));
  write.addEventListener("click", () => {
    state.modelFilter = model;
    openEditor();
  });
  hero.append(
    tags(model.brand, `${posts.length} owner notes`),
    h("h2", model.model),
    modelStats(summaryFromPosts(model, posts)),
    p("A living clipboard of owner reviews, known issues, fixes, cost notes, and trip stories.", "muted"),
    div("actions"),
  );
  hero.querySelector(".actions").append(back, share, write);
  els.modelsList.replaceChildren(hero);
  [
    ["Known issue", "Known issues"],
    ["Fix", "Fixes that worked"],
    ["Cost note", "Cost notes"],
    ["Review", "Owner reviews"],
    ["Travelogue", "Travelogues"],
    ["Owner note", "Owner notes"],
  ].forEach(([label, title]) => {
    const matching = posts.filter(post => (post.knowledge_label || "Owner note") === label);
    if (matching.length) els.modelsList.append(modelSection(title, matching));
  });
  if (!posts.length) els.modelsList.append(empty("No notes for this model yet. Be the first owner to document it."));
}

function feedEmptyState() {
  if (state.mode === "saved") {
    return empty("No saved posts yet. Save useful posts to build your personal garage shelf.");
  }
  const box = empty("No posts found. Start with a real ownership note: variant, city, odometer, cost, fix, or trip detail.");
  const actions = div("actions");
  const write = button("primary", "Write first note");
  const reset = button("secondary", "Clear filters");
  write.addEventListener("click", () => openEditor());
  reset.addEventListener("click", () => {
    els.search.value = "";
    els.topic.value = "All";
    els.brandFilter.value = "All";
    state.modelFilter = null;
    loadFeed(true);
  });
  actions.append(write, reset);
  box.append(actions);
  return box;
}

function modelSection(title, posts) {
  const section = div("knowledge-section");
  section.append(h("h3", title));
  posts.forEach(post => {
    const item = div("knowledge-item");
    const open = button("secondary", "Open");
    const share = button("secondary", "Share");
    open.addEventListener("click", () => openPost(post.id, true));
    share.addEventListener("click", () => sharePost(post));
    if (post.knowledge_label === "Fix") item.classList.add("verified-fix");
    if (post.is_pinned) item.classList.add("pinned-note");
    item.append(
      tags(post.knowledge_label || "Owner note", post.variant || post.city || post.brand),
      h("h4", post.title),
      fixProof(post),
      qualityProof(post),
      p(modelDetails(post), "muted"),
      p(excerpt(post.excerpt)),
    );
    const actions = div("actions");
    const helpful = button("secondary", `Helpful (${post.helpful_count || 0})`);
    const stale = button("secondary", `Stale info (${post.stale_count || 0})`);
    helpful.addEventListener("click", () => markQuality(post, "helpful"));
    stale.addEventListener("click", () => markQuality(post, "stale"));
    actions.append(open, share, helpful, stale);
    if (post.knowledge_label === "Fix") {
      const worked = button("primary", "Worked for me");
      worked.addEventListener("click", () => confirmFix(post));
      actions.append(worked);
    } else {
    }
    item.append(actions);
    section.append(item);
  });
  return section;
}

async function confirmFix(post) {
  try {
    const response = await api.confirmFix(post.id, actorToken());
    post.fix_confirmation_count = response.fix_confirmation_count;
    if (state.selected?.id === post.id) state.selected.fix_confirmation_count = response.fix_confirmation_count;
    showToast("Marked as worked for you.");
    if (state.modelFilter && state.modelPosts.length) renderModelNotebook(state.modelFilter, state.modelPosts);
    else if (state.selected?.id === post.id) renderPost(state.selected);
  } catch (error) {
    showToast(error.message);
  }
}

async function markQuality(post, signal) {
  try {
    const response = signal === "helpful"
      ? await api.helpful(post.id, actorToken())
      : await api.stale(post.id, actorToken());
    applyQuality(post, response);
    showToast(signal === "helpful" ? "Marked helpful." : "Flagged as possibly stale.");
    rerenderPostContext(post);
  } catch (error) {
    showToast(error.message);
  }
}

function applyQuality(post, response) {
  post.helpful_count = response.helpful_count;
  post.stale_count = response.stale_count;
  post.is_pinned = response.is_pinned;
  state.posts.filter(item => item.id === post.id).forEach(item => Object.assign(item, post));
  state.modelPosts.filter(item => item.id === post.id).forEach(item => Object.assign(item, post));
  if (state.selected?.id === post.id) Object.assign(state.selected, post);
}

function rerenderPostContext(post) {
  if (state.modelFilter && state.modelPosts.length) renderModelNotebook(state.modelFilter, state.modelPosts);
  else if (state.selected?.id === post.id) renderPost(state.selected);
  renderFeed();
}

async function sharePost(post) {
  await shareLink({
    title: post.title,
    text: excerpt(post.excerpt || post.body || ""),
    url: shareUrl(`/share/posts/${post.id}`),
  });
}

async function shareModel(model) {
  await shareLink({
    title: `${model.brand} ${model.model} owner notebook`,
    text: "Reviews, known issues, fixes, costs, and travelogues from Autoflex owners.",
    url: shareUrl(`/share/models?${new URLSearchParams({ brand: model.brand, model: model.model })}`),
  });
}

async function shareLink(payload) {
  try {
    if (navigator.share) {
      await navigator.share(payload);
      return;
    }
    await navigator.clipboard.writeText(payload.url);
    showToast("Share link copied.");
  } catch (error) {
    if (error.name !== "AbortError") showToast("Could not share this link.");
  }
}

function shareUrl(path) {
  return new URL(path, location.origin).href;
}

async function getJson(url) {
  const response = await fetch(url);
  return checked(response);
}

async function sendJson(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return checked(response);
}

async function uploadImage(file) {
  const body = new FormData();
  body.append("image", file);
  const response = await fetch("/api/uploads", { method: "POST", body });
  return checked(response);
}

async function checked(response) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function captureClientError(message, source, stack) {
  const body = JSON.stringify({
    message: String(message || "Client error").slice(0, 500),
    source: String(source || "").slice(0, 300),
    stack: String(stack || "").slice(0, 4000),
    path: `${location.pathname}${location.hash}`.slice(0, 300),
    actor_token: actorToken(),
  });
  fetch("/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

function fillSelect(select, values) {
  select.replaceChildren(...values.map(value => new Option(value, value)));
}

function tags(brand, topic) {
  const row = div("tags");
  row.append(span("tag", brand), span("tag muted-tag", topic));
  return row;
}

function meta(post) {
  return p(`${post.author} | ${timeAgo(post.created_at)} | ${post.likes} likes | ${post.comment_count} comments | ${post.views} views`, "meta");
}

function facts(post) {
  const values = [post.model, post.variant, post.city, post.odometer_km ? `${post.odometer_km.toLocaleString()} km` : ""].filter(Boolean);
  const row = div("fact-row");
  if (!values.length) return row;
  row.append(...values.map(value => span("fact", value)));
  return row;
}

function fixProof(post) {
  const count = post.fix_confirmation_count || 0;
  if ((post.knowledge_label || "") !== "Fix" && !count) return div("hidden");
  const text = count === 1 ? "1 owner says this worked" : `${count} owners say this worked`;
  return span(count ? "fact proof-fact" : "fact", count ? text : "Fix awaiting owner confirmations");
}

function qualityProof(post) {
  const row = div("fact-row");
  if (post.is_pinned) row.append(span("fact pin-fact", "Pinned by moderators"));
  if (post.helpful_count) row.append(span("fact proof-fact", `${post.helpful_count} helpful`));
  if (post.stale_count) row.append(span("fact stale-fact", `${post.stale_count} stale flags`));
  return row.children.length ? row : div("hidden");
}

function modelDetails(post) {
  return [post.model, post.variant, post.city, post.odometer_km ? `${post.odometer_km.toLocaleString()} km` : ""]
    .filter(Boolean)
    .join(" • ");
}

function modelStats(model) {
  const row = div("model-stats");
  row.append(span("fact", `${model.post_count} notes`));
  if (model.known_issue_count) row.append(span("fact danger-fact", `${model.known_issue_count} known issues`));
  if (model.fix_count) row.append(span("fact", `${model.fix_count} fixes`));
  if (model.cost_note_count) row.append(span("fact", `${model.cost_note_count} cost notes`));
  return row;
}

function summaryFromPosts(model, posts) {
  return {
    ...model,
    post_count: posts.length,
    known_issue_count: posts.filter(post => post.knowledge_label === "Known issue").length,
    fix_count: posts.filter(post => post.knowledge_label === "Fix").length,
    cost_note_count: posts.filter(post => post.knowledge_label === "Cost note").length,
  };
}

function modelHash(model) {
  return `#model-${encodeURIComponent(model.brand)}--${encodeURIComponent(model.model)}`;
}

function hashModel() {
  const value = location.hash.replace("#model-", "");
  const [brand, model] = value.split("--").map(decodeURIComponent);
  return brand && model ? { brand, model, post_count: 0, known_issue_count: 0, fix_count: 0, cost_note_count: 0 } : null;
}

function excerpt(value) {
  return value.length >= 280 ? `${value}...` : value;
}

function image(src, className) {
  const img = document.createElement("img");
  img.src = src;
  img.className = className;
  img.alt = "";
  img.loading = "lazy";
  return img;
}

function input(labelText) {
  const wrap = label(labelText);
  const input = document.createElement("input");
  wrap.append(input);
  return { wrap, input };
}

function textarea(labelText, rows) {
  const wrap = label(labelText);
  const input = document.createElement("textarea");
  input.rows = rows;
  wrap.append(input);
  return { wrap, input };
}

function label(text) {
  const el = document.createElement("label");
  el.append(document.createTextNode(text));
  return el;
}

function div(className) {
  const el = document.createElement("div");
  el.className = className;
  return el;
}

function span(className, text) {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return el;
}

function h(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

function p(text, className) {
  const el = document.createElement("p");
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

function button(className, text) {
  const el = document.createElement("button");
  el.className = className;
  el.textContent = text;
  return el;
}

function empty(text) {
  const el = div("empty");
  el.append(p(text, "muted"));
  return el;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  setTimeout(() => els.toast.classList.add("hidden"), 3200);
}

function tokenKey(id) {
  return `autoflex.edit.${id}`;
}

function persistSaved() {
  localStorage.setItem("autoflex.saved.ids", JSON.stringify([...state.saved]));
}

function createSaveToken() {
  const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.replace(".", "");
  localStorage.setItem("autoflex.save.token", token);
  return token;
}

function actorToken() {
  return state.profile?.profileToken || state.saveToken;
}

function debounce(fn, ms) {
  let handle;
  return () => {
    clearTimeout(handle);
    handle = setTimeout(fn, ms);
  };
}

function timeAgo(timestamp) {
  const date = new Date(timestamp.replace(" ", "T") + "Z");
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds >= 31536000) return `${Math.floor(seconds / 31536000)}y ago`;
  if (seconds >= 2592000) return `${Math.floor(seconds / 2592000)}mo ago`;
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ago`;
  return "just now";
}
