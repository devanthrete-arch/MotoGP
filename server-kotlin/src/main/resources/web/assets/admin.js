const state = {
  reports: [],
  feedback: [],
  clientErrors: [],
  offset: 0,
  limit: 20,
  hasMore: false,
  token: localStorage.getItem("autoflex.admin.token") || "",
};

const els = {
  form: document.querySelector("#admin-form"),
  token: document.querySelector("#admin-token"),
  feedback: document.querySelector("#feedback"),
  clientErrors: document.querySelector("#client-errors"),
  reports: document.querySelector("#reports"),
  loadMore: document.querySelector("#load-more-reports"),
  toast: document.querySelector("#toast"),
};

document.addEventListener("DOMContentLoaded", () => {
  els.token.value = state.token;
  els.form.addEventListener("submit", event => {
    event.preventDefault();
    state.token = els.token.value.trim();
    localStorage.setItem("autoflex.admin.token", state.token);
    loadAdminInbox(true);
  });
  els.loadMore.addEventListener("click", () => loadReports(false));
  if (state.token) loadAdminInbox(true);
});

async function loadAdminInbox(reset) {
  await Promise.all([loadFeedback(), loadClientErrors(), loadReports(reset)]);
}

async function loadFeedback() {
  els.feedback.replaceChildren(empty("Loading feedback..."));
  try {
    const response = await getJson(`/api/admin/feedback?${new URLSearchParams({
      admin_token: state.token,
      limit: 20,
      offset: 0,
    })}`);
    state.feedback = response.feedback;
    renderFeedback();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadClientErrors() {
  els.clientErrors.replaceChildren(empty("Loading client errors..."));
  try {
    const response = await getJson(`/api/admin/client-errors?${new URLSearchParams({
      admin_token: state.token,
      limit: 20,
      offset: 0,
    })}`);
    state.clientErrors = response.errors;
    renderClientErrors();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadReports(reset) {
  if (reset) {
    state.offset = 0;
    state.reports = [];
    els.reports.replaceChildren(empty("Loading reports..."));
  }
  try {
    const response = await getJson(`/api/admin/reports?${new URLSearchParams({
      admin_token: state.token,
      limit: state.limit,
      offset: state.offset,
    })}`);
    state.reports = reset ? response.reports : [...state.reports, ...response.reports];
    state.offset = state.reports.length;
    state.hasMore = response.has_more;
    renderReports();
  } catch (error) {
    showToast(error.message);
  }
}

function renderFeedback() {
  els.feedback.replaceChildren();
  if (!state.feedback.length) {
    els.feedback.append(empty("No product feedback yet."));
    return;
  }
  state.feedback.forEach(item => {
    const card = div("post-card report-card");
    const main = div("post-main");
    main.append(
      tags(`Feedback #${item.id}`, item.context || "App"),
      h("h3", item.name || "Anonymous"),
      p(item.message),
      p(timeAgo(item.created_at), "meta"),
    );
    card.append(main);
    els.feedback.append(card);
  });
}

function renderClientErrors() {
  els.clientErrors.replaceChildren();
  if (!state.clientErrors.length) {
    els.clientErrors.append(empty("No client errors captured yet."));
    return;
  }
  state.clientErrors.forEach(error => {
    const card = div("post-card report-card");
    const main = div("post-main");
    main.append(
      tags(`Error #${error.id}`, error.path || "App"),
      h("h3", error.message),
      p(error.source || "No source captured", "meta"),
      p(error.stack || "No stack trace captured"),
      p(timeAgo(error.created_at), "meta"),
    );
    card.append(main);
    els.clientErrors.append(card);
  });
}

function renderReports() {
  els.reports.replaceChildren();
  els.loadMore.classList.toggle("hidden", !state.hasMore);
  if (!state.reports.length) {
    els.reports.append(empty("No reports yet."));
    return;
  }
  state.reports.forEach(report => {
    const card = div("post-card report-card");
    const main = div("post-main");
    main.append(
      tags(`Report #${report.id}`, `Post #${report.post_id}`),
      h("h3", report.post_title),
      p(report.reason),
      p(`Reported by ${report.reporter} | ${timeAgo(report.created_at)}`, "meta"),
      report.is_pinned ? p("Pinned for model notebooks.", "meta") : p("Not pinned.", "meta"),
      report.owner_blocked ? p("Owner blocked from future community writes.", "meta") : p("Owner not blocked.", "meta"),
      reportActions(report),
    );
    card.append(main);
    els.reports.append(card);
  });
}

function reportActions(report) {
  const row = div("actions");
  const open = document.createElement("a");
  const dismiss = button("secondary", "Dismiss report");
  const pin = button("secondary", report.is_pinned ? "Unpin post" : "Pin post");
  const block = button("secondary", report.owner_blocked ? "Owner blocked" : "Block owner");
  const remove = button("danger", "Delete post");
  open.className = "primary link-button";
  open.href = `/#post-${report.post_id}`;
  open.textContent = "Open post";
  dismiss.addEventListener("click", () => dismissReport(report.id));
  pin.addEventListener("click", () => setPinned(report));
  block.disabled = report.owner_blocked;
  block.addEventListener("click", () => blockOwner(report));
  remove.addEventListener("click", () => deleteReportedPost(report.post_id));
  row.append(open, dismiss, pin, block, remove);
  return row;
}

async function dismissReport(id) {
  try {
    await sendJson(`/api/admin/reports/${id}?${new URLSearchParams({ admin_token: state.token })}`, "DELETE");
    showToast("Report dismissed.");
    await loadReports(true);
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteReportedPost(id) {
  if (!confirm("Delete this post, its comments, and all reports?")) return;
  try {
    await sendJson(`/api/admin/posts/${id}?${new URLSearchParams({ admin_token: state.token })}`, "DELETE");
    showToast("Post removed.");
    await loadReports(true);
  } catch (error) {
    showToast(error.message);
  }
}

async function blockOwner(report) {
  if (!confirm("Block the browser/profile behind this reported post from future writes?")) return;
  try {
    await sendJson(`/api/admin/posts/${report.post_id}/block-owner?${new URLSearchParams({ admin_token: state.token })}`, "PUT", {
      reason: report.reason,
    });
    showToast("Owner blocked.");
    await loadReports(true);
  } catch (error) {
    showToast(error.message);
  }
}

async function setPinned(report) {
  try {
    await sendJson(`/api/admin/posts/${report.post_id}/pin?${new URLSearchParams({ admin_token: state.token })}`, "PUT", {
      is_pinned: !report.is_pinned,
    });
    showToast(report.is_pinned ? "Post unpinned." : "Post pinned.");
    await loadReports(true);
  } catch (error) {
    showToast(error.message);
  }
}

async function getJson(url) {
  const response = await fetch(url);
  return checked(response);
}

async function sendJson(url, method, body) {
  const options = { method };
  if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  return checked(response);
}

async function checked(response) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function tags(first, second) {
  const row = div("tags");
  row.append(span("tag", first), span("tag muted-tag", second));
  return row;
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
  el.type = "button";
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

function timeAgo(timestamp) {
  const date = new Date(timestamp.replace(" ", "T") + "Z");
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ago`;
  return "just now";
}
