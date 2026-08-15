/**
 * Route-specific Open Graph previews for social crawlers.
 *
 * AutoFlex ships as a static SPA, so every URL is served the same index.html and
 * every share preview would otherwise read "AutoFlex". vercel.json rewrites
 * *social crawler* user agents (and only those — search engines are excluded so
 * they keep indexing the real app) to this function, which re-emits the same
 * document shell with per-route title/description/canonical/og tags.
 *
 * Rules this file must keep:
 *  - No inline <script> and no inline style attributes: the CSP is
 *    `script-src 'self'; style-src 'self'` with no 'unsafe-inline'.
 *  - Every interpolated value is HTML-escaped; ids/slugs are validated first.
 *  - Supabase enrichment uses the publishable (anon) key against public-read
 *    tables only, with a short timeout and a full try/catch.
 *  - A meta refresh pushes any human that lands here back into the SPA.
 */

const SITE_NAME = "AutoFlex";
const DEFAULT_ORIGIN = "https://moto-gp-git-master-anthrete-innovation-pvt-ltd.vercel.app";
const OG_IMAGE_PATH = "/og-cover.png";
const DEFAULT_TITLE = "AutoFlex — owner notes that survive the showroom pitch";
const DEFAULT_DESCRIPTION =
  "Owner notes, running costs, service history and document vault for Indian drivers. Local-first, your data stays yours.";

// Same shapes as src/share.ts. Anything else degrades to the parent screen.
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,63})?$/;

// Search engines must never be redirected into this shim: they should index the
// real SPA. The rewrite allow-list already excludes them; this is the second gate.
const SEARCH_ENGINE =
  /(googlebot|google-inspectiontool|adsbot-google|storebot-google|bingbot|bingpreview|duckduckbot|yandexbot|baiduspider|sogou|seznambot|petalbot|ia_archiver)/;

const SOCIAL_CRAWLER =
  /(facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|slack-imgproxy|discordbot|whatsapp|telegrambot|pinterest|redditbot|applebot|skypeuripreview|embedly|iframely|mastodon|vkshare|snapchat|line-podcast|nuzzel|qwantify|bitlybot|flipboard|tumblr|google-read-aloud)/;

const SCREEN_META = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  "/analytics": {
    title: "Analytics · AutoFlex",
    description: "Running-cost analytics built from real service, fuel and repair entries.",
  },
  "/community": {
    title: "Owner notes · AutoFlex",
    description: "Owner notes from Indian drivers: known issues, confirmed fixes and real running costs.",
  },
  "/community/new": {
    title: "Write an owner note · AutoFlex",
    description: "Share what you learned running your car, so the next owner does not pay to learn it.",
  },
  "/creators": {
    title: "Creator Connect · AutoFlex",
    description: "Owner-reviewers worth following before you buy.",
  },
  "/garage": {
    title: "Garage · AutoFlex",
    description: "Service history, running costs and reminders for every vehicle you own.",
  },
  "/kyv": {
    title: "Know Your Vehicle · AutoFlex",
    description: "Specs, service intervals and ownership realities, decoded.",
  },
  "/shortlist": {
    title: "Shortlist · AutoFlex",
    description: "Compare shortlisted cars with owner evidence, budgets and inspection checks.",
  },
  "/vault": {
    title: "Document Vault · AutoFlex",
    description: "RC, insurance and service papers kept together on your own device.",
  },
  "/cars": { title: "Cars · AutoFlex", description: "Owner evidence for the cars Indians actually drive." },
  "/cities": { title: "City circles · AutoFlex", description: "Owner notes grouped by the city they came from." },
  "/playbooks": {
    title: "Ownership playbooks · AutoFlex",
    description: "What owners learned, distilled into a buying and running playbook per model.",
  },
};

// Profile routes exist but are personal; they get the generic card and noindex.
const PRIVATE_PREFIXES = ["/profile", "/moderation"];

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const clamp = (value, max) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const titleCase = (slug) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");

const resolveOrigin = (request) => {
  const configured = process.env.VITE_PUBLIC_ORIGIN || process.env.PUBLIC_ORIGIN;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* fall through to the request host */
    }
  }
  const forwardedHost = request.headers["x-forwarded-host"] || request.headers.host;
  if (typeof forwardedHost === "string" && /^[A-Za-z0-9.:-]+$/.test(forwardedHost)) {
    const protocol = request.headers["x-forwarded-proto"] === "http" ? "http" : "https";
    return `${protocol}://${forwardedHost}`;
  }
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : DEFAULT_ORIGIN;
};

/** Normalise the rewritten path: single leading slash, no traversal, no query. */
const normalisePath = (raw) => {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== "string" || !candidate) return "/";
  let path = candidate.split("?")[0].split("#")[0];
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path.includes("..") || path.includes("\\") || path.includes("%")) return "/";
  if (path.length > 200) return "/";
  return path || "/";
};

/** Classify a path into a preview target. Unknown or malformed → the parent screen. */
const describeRoute = (path) => {
  // Exact screen matches first, so /community/new stays the composer route.
  if (SCREEN_META[path]) return { kind: "screen", path };

  const segments = path.split("/").filter(Boolean);

  if (segments.length === 2) {
    const [collection, key] = segments;
    if (collection === "community" && ID_PATTERN.test(key)) {
      return { kind: "post", id: key, path };
    }
    if ((collection === "cars" || collection === "playbooks") && SLUG_PATTERN.test(key)) {
      return { kind: collection === "cars" ? "car" : "playbook", slug: key, path };
    }
    if (collection === "cities" && SLUG_PATTERN.test(key)) {
      return { kind: "city", slug: key, path };
    }
    // Bad id or slug: degrade to the collection screen rather than a dead page.
    const parent = `/${collection}`;
    return { kind: "screen", path: SCREEN_META[parent] ? parent : "/" };
  }

  return { kind: "screen", path: "/" };
};

const supabaseConfig = () => ({
  url: (process.env.VITE_SUPABASE_URL || "https://uxzdmlqyxausmmdpmkrr.supabase.co").replace(/\/+$/, ""),
  key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_u0w6I8umxlBbcwT2-zGaJA_rDY0SVju",
});

/**
 * Read one row from a public-read table with the publishable key.
 * Never throws and never blocks the response for long: crawlers time out fast,
 * so a slow database must degrade to the slug-derived preview.
 */
const fetchPublicRow = async (table, filter, select) => {
  const { url, key } = supabaseConfig();
  if (!url || !key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const endpoint = `${url}/rest/v1/${table}?${filter}&select=${encodeURIComponent(select)}&limit=1`;
    const response = await fetch(endpoint, {
      headers: { apikey: key, authorization: `Bearer ${key}`, accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const rows = await response.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const metaForRoute = async (route) => {
  if (route.kind === "post") {
    const row = await fetchPublicRow(
      "owner_posts",
      `id=eq.${encodeURIComponent(route.id)}`,
      "title,brand,model,variant,label,city,body,odometer_km,helpful",
    );
    if (!row) {
      return {
        title: `Owner note · ${SITE_NAME}`,
        description: "An owner note on AutoFlex: what actually happened, what it cost, what to check.",
      };
    }
    const variant = row.variant ? ` ${row.variant}` : "";
    return {
      title: clamp(`${row.brand} ${row.model}: ${row.title} · ${SITE_NAME}`, 110),
      description: clamp(
        [
          `${row.label} for ${row.brand} ${row.model}${variant}`,
          row.city ? `${row.city}` : null,
          row.body,
        ]
          .filter(Boolean)
          .join(" · "),
        200,
      ),
    };
  }

  if (route.kind === "car" || route.kind === "playbook") {
    const row = await fetchPublicRow(
      "model_playbooks",
      `id=eq.${encodeURIComponent(route.slug)}`,
      "brand,model,headline,confidence,evidence_count",
    );
    const name = row ? `${row.brand} ${row.model}` : titleCase(route.slug);
    if (route.kind === "car") {
      return {
        title: clamp(`${name} — owner notes and running costs · ${SITE_NAME}`, 110),
        description: clamp(
          row?.headline ||
            `Known issues, confirmed fixes and real running costs for the ${name}, from owners in India.`,
          200,
        ),
      };
    }
    return {
      title: clamp(`${name} ownership playbook · ${SITE_NAME}`, 110),
      description: clamp(
        row
          ? `${row.headline} · ${row.confidence} from ${row.evidence_count ?? 0} owner notes.`
          : `What ${name} owners learned, turned into buyer checks and running-cost expectations.`,
        200,
      ),
    };
  }

  if (route.kind === "city") {
    const row = await fetchPublicRow(
      "city_circles",
      `slug=eq.${encodeURIComponent(route.slug)}`,
      "city,state,headline,summary,local_signal,post_count",
    );
    const name = row?.city || titleCase(route.slug);
    return {
      title: clamp(`${name} owner circle · ${SITE_NAME}`, 110),
      description: clamp(
        row?.summary ||
          row?.headline ||
          `Owner notes, service costs and workshop experiences from drivers in ${name}.`,
        200,
      ),
    };
  }

  const screen = SCREEN_META[route.path] ?? SCREEN_META["/"];
  return { title: screen.title, description: screen.description };
};

const renderDocument = ({ canonical, description, imageUrl, path, title, indexable }) => {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);
  const safeImage = escapeHtml(imageUrl);
  // `og=0` stops the crawler rewrite from matching again, so this refresh lands
  // a human on the real SPA instead of looping back into this function.
  const refreshTarget = escapeHtml(`${path}${path.includes("?") ? "&" : "?"}og=0`);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta http-equiv="refresh" content="0; url=${refreshTarget}" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <meta name="theme-color" content="#141313" />
    ${indexable ? "" : '<meta name="robots" content="noindex" />\n    '}<link rel="canonical" href="${safeCanonical}" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_IN" />
    <meta property="og:url" content="${safeCanonical}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="AutoFlex — owner notes that survive" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />
    <meta name="twitter:image:alt" content="AutoFlex — owner notes that survive" />
  </head>
  <body>
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <p><a href="${refreshTarget}">Open ${SITE_NAME}</a></p>
  </body>
</html>
`;
};

export default async function handler(request, response) {
  const origin = resolveOrigin(request);
  const path = normalisePath(request.query?.path ?? request.url);
  const userAgent = String(request.headers["user-agent"] ?? "").toLowerCase();
  const isCrawler = SOCIAL_CRAWLER.test(userAgent);
  const isSearchEngine = SEARCH_ENGINE.test(userAgent);
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  let meta;
  try {
    const route = describeRoute(isPrivate ? "/" : path);
    meta = await metaForRoute(route);
  } catch {
    meta = { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
  }

  const body = renderDocument({
    canonical: `${origin}${path === "/" ? "/" : path}`,
    description: meta.description || DEFAULT_DESCRIPTION,
    imageUrl: `${origin}${OG_IMAGE_PATH}`,
    // A search engine that somehow reaches the shim keeps its indexing rights and
    // is pointed at the clean canonical URL; social crawler shims stay noindex.
    indexable: isSearchEngine,
    path,
    title: meta.title || DEFAULT_TITLE,
  });

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  // The response body depends on the user agent, so shared caches must split on it.
  response.setHeader("Vary", "User-Agent");
  if (!isSearchEngine) response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader(
    "Cache-Control",
    isCrawler ? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400" : "no-store",
  );
  response.status(200).send(body);
}

export const __test__ = {
  describeRoute,
  escapeHtml,
  normalisePath,
  renderDocument,
  SEARCH_ENGINE,
  SOCIAL_CRAWLER,
  titleCase,
};
