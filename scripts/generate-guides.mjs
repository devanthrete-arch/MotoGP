import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const catalog = JSON.parse(await readFile(path.join(root, "content/guides/catalog.json"), "utf8"));
const siteUrl = process.env.PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
const publicOrigin = siteUrl ? new URL(siteUrl.includes("://") ? siteUrl : `https://${siteUrl}`).origin : undefined;
if (!Array.isArray(catalog) || !catalog.length) throw new Error("Guide catalog must contain at least one article");
const slugs = new Set();
for (const guide of catalog) {
  if (!/^[a-z0-9-]+$/.test(guide.slug) || slugs.has(guide.slug)) throw new Error(`Invalid or duplicate guide slug: ${guide.slug}`);
  if (![guide.title, guide.description, guide.topic].every((value) => typeof value === "string" && value.trim())) {
    throw new Error(`Guide metadata is incomplete: ${guide.slug}`);
  }
  slugs.add(guide.slug);
}
const indexHtml = await readFile(path.join(dist, "index.html"), "utf8");
const stylesheet = indexHtml.match(/<link rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
if (!stylesheet) throw new Error("Built stylesheet not found in dist/index.html");

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const safeBody = (markdown) => sanitizeHtml(marked.parse(markdown), {
  allowedTags: ["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "a", "blockquote", "code", "pre"],
  allowedAttributes: { a: ["href", "name", "target", "rel"] },
  allowedSchemes: ["https", "mailto"],
  transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }) },
});
const absoluteUrl = (value) => publicOrigin ? new URL(value, publicOrigin).toString() : undefined;
const frame = ({ title, description, canonical, image, content }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:title" content="${escapeHtml(`${title} · Otofolks`)}"><meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="article">
  <meta name="color-scheme" content="light dark"><link rel="stylesheet" href="${stylesheet}">
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ""}
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
  <title>${escapeHtml(title)} · Otofolks</title>
</head>
<body class="guide-static">
  <main class="guide-page">${content}</main>
</body>
</html>`;

const links = catalog.map((guide) => `<article class="guide-list-item">
  ${guide.image ? `<a class="guide-list-item__image" href="/guides/${encodeURIComponent(guide.slug)}/"><img src="${escapeHtml(guide.image)}" alt="${escapeHtml(guide.imageAlt ?? "")}" width="1600" height="900"></a>` : ""}
  <div class="guide-list-item__body"><p class="guide-topic">${escapeHtml(guide.topic)} · ${Number(guide.minutes)} min read</p>
  <h2><a href="/guides/${encodeURIComponent(guide.slug)}/">${escapeHtml(guide.title)}</a></h2><p>${escapeHtml(guide.description)}</p>
  <a class="guide-read" href="/guides/${encodeURIComponent(guide.slug)}/">Read guide <span aria-hidden="true">→</span></a></div>
</article>`).join("\n");
await mkdir(path.join(dist, "guides"), { recursive: true });
await writeFile(path.join(dist, "guides/index.html"), frame({
  title: "Care guides", description: "Practical guides for caring for a car in India.", canonical: absoluteUrl("/guides/"),
  content: `<header class="guide-head"><p class="eyebrow">Otofolks guides</p><h1>Care guides</h1><p>Small, useful steps for looking after a vehicle in India.</p></header>
    <div class="guide-list">${links}</div><nav class="guide-next" aria-label="Explore Otofolks"><a class="ui-button ui-button--secondary" href="/compare">Compare cars</a><a class="ui-button ui-button--ghost" href="/">Home</a></nav>`,
}));

for (const guide of catalog) {
  const markdown = await readFile(path.join(root, `content/guides/${guide.slug}.md`), "utf8");
  const image = guide.image
    ? `<img class="guide-hero" src="${escapeHtml(guide.image)}" alt="${escapeHtml(guide.imageAlt ?? "")}" width="1600" height="900">`
    : "";
  const content = `<a class="guide-back" href="/guides/">← All guides</a>${image}
    <header class="guide-article-head"><p class="guide-topic">${escapeHtml(guide.topic)} · ${Number(guide.minutes)} min read</p>
      <h1>${escapeHtml(guide.title)}</h1><p>${escapeHtml(guide.description)}</p><time datetime="${escapeHtml(guide.publishedOn)}">${escapeHtml(guide.publishedOn)}</time>
    </header><article class="guide-prose">${safeBody(markdown)}</article>
    <nav class="guide-next" aria-label="More from Otofolks"><p>Keep exploring</p><a class="ui-button ui-button--secondary" href="/compare">Compare cars</a><a class="ui-button ui-button--ghost" href="/guides/">More guides</a></nav>`;
  const target = path.join(dist, "guides", guide.slug, "index.html");
  await mkdir(path.dirname(target), { recursive: true });
  const html = frame({
    title: guide.title, description: guide.description, canonical: absoluteUrl(`/guides/${guide.slug}/`),
    image: guide.image ? absoluteUrl(guide.image) : undefined, content,
  });
  if (!html.includes(stylesheet) || !html.includes(`<h1>${escapeHtml(guide.title)}</h1>`) || /<script\b/i.test(html)) {
    throw new Error(`Prerendered guide failed validation: ${guide.slug}`);
  }
  await writeFile(target, html);
}
