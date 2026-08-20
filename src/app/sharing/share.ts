import type { GarageVehicle, OwnerPost, ShortlistItem } from "../../core/entities";
import { modelKeyFor, type CityCircle, type OwnershipPlaybook } from "../../core/index";
import { accountPaths, titleForPath, workspacePaths } from "../routing/routes";

/**
 * Deep links + sharing for Autoflex.
 *
 * Every path is derived from the route tables in `routing.ts` (spread below) so
 * a route rename cannot silently break shared links, and model slugs are built
 * with `insights.modelKeyFor` so a shared `/cars/:slug` always resolves to the
 * same notebook the app groups posts under.
 */

/** Last-resort origin. Prefer `VITE_PUBLIC_ORIGIN`; `index.html` canonical must match this. */
export const defaultShareOrigin = "https://moto-gp-chi.vercel.app";

/** Primary screens, taken straight from the router so they cannot drift. */
export const sharePaths = {
  ...workspacePaths,
  ...accountPaths,
} as const;

export type ShareScreen = keyof typeof sharePaths;

/** Collection prefixes for shareable detail routes. */
export const shareDetailPaths = {
  car: "/cars",
  city: "/cities",
  playbook: "/playbooks",
  post: "/community",
} as const;

export type ShareDetailKind = keyof typeof shareDetailPaths;

/** The composer route already understood by `routeFromPath`. */
export const composePath = "/community/new";

export type DeepLinkTarget = ShareScreen | ShareDetailKind | "compose";

/** Screens a broken detail link degrades to, instead of emitting a dead path. */
const detailParents: Record<ShareDetailKind, ShareScreen> = {
  car: "shortlist",
  city: "community",
  playbook: "community",
  post: "community",
};

/** The only query keys a deep link may carry. Never accepts user or profile data. */
export type ShareRef = "app" | "email" | "qr" | "share";
const allowedRefs: readonly ShareRef[] = ["app", "email", "qr", "share"];

export type DeepLinkParams = {
  brand?: string;
  city?: string;
  model?: string;
  postId?: string;
  ref?: string;
  slug?: string;
};

export type DeepLinkOptions = {
  origin?: string;
};

/**
 * Slug shape shared by `/cars`, `/playbooks` and `/cities`.
 * Lowercase alphanumerics and single dashes only: no `.`, `/`, `\`, `%` or
 * whitespace, so `..%2f` style traversal can never reach the path.
 */
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

/** Post ids are opaque (`note-12`, ULIDs, UUIDs) but still tightly bounded. */
const idPattern = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,63})?$/;

/** Reserved child routes that must never be treated as a detail id. */
const reservedPostIds = new Set(["new"]);

const readEnvOrigin = (): string => {
  try {
    return (import.meta.env?.VITE_PUBLIC_ORIGIN as string | undefined)?.trim() ?? "";
  } catch {
    return "";
  }
};

const normaliseOrigin = (candidate: string | undefined | null): string | null => {
  if (!candidate) return null;
  try {
    const url = new URL(candidate.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
};

/** Configurable canonical origin: explicit → build env → current page → fallback. */
export const resolveShareOrigin = (origin?: string): string => {
  const runtimeOrigin =
    typeof globalThis !== "undefined" && typeof globalThis.location?.origin === "string"
      ? globalThis.location.origin
      : null;

  return (
    normaliseOrigin(origin) ??
    normaliseOrigin(readEnvOrigin()) ??
    normaliseOrigin(runtimeOrigin) ??
    defaultShareOrigin
  );
};

/** Same normalisation as `modelKeyFor`, with dash trimming, for free-text values. */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const isShareScreen = (value: string): value is ShareScreen =>
  Object.prototype.hasOwnProperty.call(sharePaths, value);

const safeSlug = (candidate: string | undefined): string | null => {
  const value = (candidate ?? "").trim();
  return slugPattern.test(value) ? value : null;
};

const safeId = (candidate: string | undefined): string | null => {
  const value = (candidate ?? "").trim();
  if (!idPattern.test(value)) return null;
  return reservedPostIds.has(value.toLowerCase()) ? null : value;
};

/** Model slug for `/cars/:slug` and `/playbooks/:slug`. Identical to `modelKeyFor`. */
export const modelSlugFor = (brand: string | undefined, model: string | undefined): string | null =>
  safeSlug(modelKeyFor((brand ?? "").trim(), (model ?? "").trim()));

export const citySlugFor = (city: string | undefined): string | null => safeSlug(slugify((city ?? "").trim()));

const detailSlugFor = (kind: ShareDetailKind, params: DeepLinkParams): string | null => {
  if (kind === "post") return safeId(params.postId ?? params.slug);
  if (kind === "city") return safeSlug(params.slug) ?? citySlugFor(params.city);
  return safeSlug(params.slug) ?? modelSlugFor(params.brand, params.model);
};

const isDetailKind = (target: DeepLinkTarget): target is ShareDetailKind =>
  Object.prototype.hasOwnProperty.call(shareDetailPaths, target);

/** Relative canonical path for a target. Always starts with `/`, never contains `..`. */
export const deepLinkPathFor = (target: DeepLinkTarget, params: DeepLinkParams = {}): string => {
  if (target === "compose") return composePath;

  if (isDetailKind(target)) {
    const slug = detailSlugFor(target, params);
    if (!slug) return sharePaths[detailParents[target]];
    return `${shareDetailPaths[target]}/${slug}`;
  }

  return isShareScreen(target) ? sharePaths[target] : sharePaths.home;
};

const refQueryFor = (ref: string | undefined): string => {
  const value = (ref ?? "").trim().toLowerCase();
  return allowedRefs.includes(value as ShareRef) ? `?ref=${value}` : "";
};

/**
 * Absolute, canonical, shareable URL.
 * Bad input degrades to the parent screen rather than emitting a broken path,
 * and only allow-listed `ref` tokens survive into the query string.
 */
export const buildDeepLink = (
  target: DeepLinkTarget,
  params: DeepLinkParams = {},
  options: DeepLinkOptions = {},
): string => {
  const origin = resolveShareOrigin(options.origin);
  const path = deepLinkPathFor(target, params);
  const suffix = path === "/" ? "" : path;
  return `${origin}${suffix || "/"}${refQueryFor(params.ref)}`;
};

/* -------------------------------------------------------------------------- */
/* Share payloads                                                              */
/* -------------------------------------------------------------------------- */

export type SharePayloadWithUrl = {
  text: string;
  title: string;
  url: string;
};

export type ShareablePost = Pick<
  OwnerPost,
  "body" | "brand" | "city" | "helpful" | "id" | "label" | "model" | "odometerKm" | "title" | "variant"
>;
export type ShareableCar = Pick<ShortlistItem, "brand" | "budget" | "model" | "status">;
export type ShareableVehicle = Pick<
  GarageVehicle,
  "brand" | "city" | "model" | "nickname" | "odometerKm" | "variant"
>;
export type ShareableCity = Pick<CityCircle, "city" | "localSignal" | "topBrands"> & { postCount?: number };
export type ShareablePlaybook = Pick<
  OwnershipPlaybook,
  "brand" | "confidence" | "evidenceCount" | "headline" | "model"
>;

export type ShareContent =
  | { car: ShareableCar; kind: "car" }
  | { city: ShareableCity; kind: "city" }
  | { kind: "playbook"; playbook: ShareablePlaybook }
  | { kind: "post"; post: ShareablePost }
  | { kind: "screen"; ref?: string; screen: ShareScreen }
  | { kind: "vehicle"; vehicle: ShareableVehicle };

const kilometres = (value: number): string =>
  Number.isFinite(value) ? `${Math.max(0, Math.round(value)).toLocaleString("en-IN")} km` : "km not shared";

const rupees = (value: number): string =>
  Number.isFinite(value) && value > 0 ? `₹${Math.round(value).toLocaleString("en-IN")}` : "Budget not set";

const screenBlurbs: Record<ShareScreen, string> = {
  analytics: "Running-cost analytics built from real service, fuel and repair entries.",
  community: "Owner notes from Indian drivers: known issues, confirmed fixes and real running costs.",
  creators: "Creator Connect: owner-reviewers worth following before you buy.",
  following: "The models, topics and cities this Autoflex profile follows.",
  garage: "Autoflex Garage keeps service history, costs and reminders for every vehicle you own.",
  home: "Autoflex keeps owner notes, running costs, documents and buying decisions in one place.",
  kyv: "Know Your Vehicle: specs, service intervals and ownership realities, decoded.",
  notifications: "Autoflex alerts for followed models, cities and garage reminders.",
  profile: "An Autoflex owner profile.",
  saved: "Owner notes saved for later on Autoflex.",
  settings: "Autoflex privacy, sync and notification settings.",
  shortlist: "Compare shortlisted cars with owner evidence, budgets and inspection checks.",
  vault: "Document Vault keeps RC, insurance and service papers together, on your device.",
};

/** Builds `{title, text, url}` for any shareable content kind. */
export const sharePayloadFor = (content: ShareContent, options: DeepLinkOptions = {}): SharePayloadWithUrl => {
  switch (content.kind) {
    case "post": {
      const { post } = content;
      return {
        title: `${post.brand} ${post.model}: ${post.title}`,
        text: [
          `${post.title}`,
          `${post.label} for ${post.brand} ${post.model}${post.variant ? ` ${post.variant}` : ""}`,
          `${post.city || "City not shared"} · ${post.odometerKm.toLocaleString("en-IN")} km · ${post.helpful} helpful`,
          post.body.slice(0, 180),
        ].join("\n"),
        url: buildDeepLink("post", { postId: post.id, ref: "share" }, options),
      };
    }

    case "car": {
      const { car } = content;
      return {
        title: `${car.brand} ${car.model} on Autoflex`,
        text: [
          `${car.brand} ${car.model} — owner notes, known issues and running costs before you buy.`,
          `Shortlist status: ${car.status} · Budget: ${rupees(car.budget)}`,
        ].join("\n"),
        url: buildDeepLink("car", { brand: car.brand, model: car.model, ref: "share" }, options),
      };
    }

    case "vehicle": {
      // A garage entry is owner-private, so the link points at the public model
      // page rather than at anybody's personal record.
      const { vehicle } = content;
      const name = vehicle.nickname?.trim() || `${vehicle.brand} ${vehicle.model}`;
      return {
        title: `${name} — ${vehicle.brand} ${vehicle.model}`,
        text: [
          `${vehicle.brand} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ""} · ${kilometres(vehicle.odometerKm)}`,
          `Owner notes and running costs for this model on Autoflex.`,
        ].join("\n"),
        url: buildDeepLink("car", { brand: vehicle.brand, model: vehicle.model, ref: "share" }, options),
      };
    }

    case "city": {
      const { city } = content;
      const brands = city.topBrands?.filter(Boolean).slice(0, 3) ?? [];
      const notes = typeof city.postCount === "number" ? city.postCount : undefined;
      return {
        title: `${city.city} owner circle on Autoflex`,
        text: [
          `${city.localSignal} activity in ${city.city}${notes === undefined ? "" : ` · ${notes} owner note${notes === 1 ? "" : "s"}`}.`,
          brands.length ? `Most discussed: ${brands.join(", ")}.` : "Owner notes from drivers in this city.",
        ].join("\n"),
        url: buildDeepLink("city", { city: city.city, ref: "share" }, options),
      };
    }

    case "playbook": {
      const { playbook } = content;
      return {
        title: `${playbook.brand} ${playbook.model} ownership playbook`,
        text: [
          playbook.headline,
          `${playbook.confidence} · built from ${playbook.evidenceCount} owner note${playbook.evidenceCount === 1 ? "" : "s"}.`,
        ].join("\n"),
        url: buildDeepLink("playbook", { brand: playbook.brand, model: playbook.model, ref: "share" }, options),
      };
    }

    case "screen":
    default: {
      const screen = content.kind === "screen" ? content.screen : "home";
      const path = deepLinkPathFor(screen);
      return {
        title: titleForPath(path),
        text: screenBlurbs[screen] ?? screenBlurbs.home,
        url: buildDeepLink(screen, { ref: content.kind === "screen" ? (content.ref ?? "share") : "share" }, options),
      };
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Share / copy ladder                                                         */
/* -------------------------------------------------------------------------- */

export type WebShareData = {
  text?: string;
  title?: string;
  url?: string;
};

export type ShareCapableNavigator = {
  canShare?: (data: WebShareData) => boolean;
  clipboard?: { writeText?: (text: string) => Promise<void> } | null;
  share?: (data: WebShareData) => Promise<void>;
};

export type LegacyCopyElement = {
  focus?: () => void;
  select?: () => void;
  setAttribute?: (name: string, value: string) => void;
  style?: Record<string, string>;
  value: string;
};

export type ShareCapableDocument = {
  body?: {
    appendChild: (node: LegacyCopyElement) => void;
    removeChild: (node: LegacyCopyElement) => void;
  } | null;
  createElement?: (tag: string) => LegacyCopyElement;
  execCommand?: (command: string) => boolean;
};

export type ShareEnvironment = {
  document?: ShareCapableDocument | null;
  navigator?: ShareCapableNavigator | null;
  prompt?: ((message: string, value?: string) => string | null) | null;
};

export type ShareResult =
  | { status: "cancelled"; via: "prompt" | "web-share" }
  | { status: "copied"; via: "clipboard" | "legacy-copy" }
  | { status: "failed"; reason: string }
  | { status: "manual"; via: "prompt" }
  | { status: "shared"; via: "web-share" }
  | { status: "unsupported" };

/** Plain-text form used by every non-native fallback. */
export const formatShareText = (payload: SharePayloadWithUrl): string =>
  [payload.title, "", payload.text, payload.url].join("\n").trim();

const defaultEnvironment = (): ShareEnvironment => {
  const scope = globalThis as unknown as {
    document?: unknown;
    navigator?: unknown;
    prompt?: (message: string, value?: string) => string | null;
  };
  return {
    document: (scope.document as ShareCapableDocument | undefined) ?? null,
    navigator: (scope.navigator as ShareCapableNavigator | undefined) ?? null,
    prompt: typeof scope.prompt === "function" ? scope.prompt.bind(scope) : null,
  };
};

const isCancellation = (error: unknown): boolean => {
  if (!error) return false;
  const named = error as { message?: unknown; name?: unknown };
  if (named.name === "AbortError") return true;
  if (named.name === "NotAllowedError") return false;
  const message = typeof named.message === "string" ? named.message.toLowerCase() : "";
  return message.includes("abort") || message.includes("cancel");
};

const legacyCopy = (documentLike: ShareCapableDocument | null | undefined, text: string): boolean => {
  if (!documentLike?.createElement || !documentLike.execCommand || !documentLike.body) return false;
  let element: LegacyCopyElement | null = null;
  try {
    element = documentLike.createElement("textarea");
    element.value = text;
    element.setAttribute?.("readonly", "");
    // CSSOM assignment (not an inline `style` attribute) so the strict CSP holds.
    if (element.style) {
      element.style.position = "fixed";
      element.style.top = "-1000px";
      element.style.opacity = "0";
    }
    documentLike.body.appendChild(element);
    element.select?.();
    element.focus?.();
    return documentLike.execCommand("copy") === true;
  } catch {
    return false;
  } finally {
    try {
      if (element) documentLike.body?.removeChild(element);
    } catch {
      /* the element was already detached */
    }
  }
};

/**
 * Web Share → clipboard → execCommand → prompt.
 * Never throws; a user cancelling the native sheet is reported separately from
 * a browser refusing the request.
 */
export const shareOrCopy = async (
  payload: SharePayloadWithUrl,
  environment?: ShareEnvironment,
): Promise<ShareResult> => {
  try {
    const scope = environment ?? defaultEnvironment();
    const text = formatShareText(payload);
    const shareData: WebShareData = { text: payload.text, title: payload.title, url: payload.url };
    const navigatorLike = scope.navigator ?? null;

    if (typeof navigatorLike?.share === "function") {
      const shareable = typeof navigatorLike.canShare === "function" ? navigatorLike.canShare(shareData) : true;
      if (shareable) {
        try {
          await navigatorLike.share(shareData);
          return { status: "shared", via: "web-share" };
        } catch (error) {
          if (isCancellation(error)) return { status: "cancelled", via: "web-share" };
          // Anything else (permission, unsupported target) falls through to copy.
        }
      }
    }

    const clipboard = navigatorLike?.clipboard ?? null;
    const writeText = clipboard?.writeText;
    if (typeof writeText === "function") {
      try {
        await writeText.call(clipboard, text);
        return { status: "copied", via: "clipboard" };
      } catch {
        /* clipboard blocked — fall through */
      }
    }

    if (legacyCopy(scope.document, text)) return { status: "copied", via: "legacy-copy" };

    if (typeof scope.prompt === "function") {
      const answer = scope.prompt("Copy this Autoflex link", payload.url);
      return answer === null ? { status: "cancelled", via: "prompt" } : { status: "manual", via: "prompt" };
    }

    return { status: "unsupported" };
  } catch (error) {
    return { status: "failed", reason: error instanceof Error ? error.message : "Sharing failed" };
  }
};

export type ShareContentOptions = DeepLinkOptions & {
  environment?: ShareEnvironment;
};

/** Build the payload for a piece of content and run the fallback ladder. */
export const shareContent = async (
  content: ShareContent,
  options: ShareContentOptions = {},
): Promise<ShareResult> => {
  const { environment, ...linkOptions } = options;
  return shareOrCopy(sharePayloadFor(content, linkOptions), environment);
};

/** Ready-made `setActionMessage` copy for every branch of `ShareResult`. */
export const shareResultMessage = (result: ShareResult): string => {
  switch (result.status) {
    case "shared":
      return "Shared.";
    case "copied":
      return "Link copied. Paste it anywhere.";
    case "manual":
      return "Copy the link from the box to share it.";
    case "cancelled":
      return "Sharing cancelled.";
    case "unsupported":
      return "This browser cannot share or copy. Copy the link from the address bar.";
    case "failed":
    default:
      return "Sharing was blocked by the browser. Copy the link from the address bar instead.";
  }
};
