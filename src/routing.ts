export type WorkspaceScreen =
  | "home"
  | "shortlist"
  | "garage"
  | "community"
  | "account"
  | "kyv"
  | "vault"
  | "analytics"
  | "creators";
export type AccountView = "profile" | "saved" | "following" | "notifications" | "settings";

/**
 * Shareable detail collections.
 *
 * `share.ts` already emits `/cars/:slug`, `/cities/:slug` and `/playbooks/:slug`;
 * these are the router entries for them. They deliberately reuse an existing
 * `WorkspaceScreen` instead of adding a new one, because `sharePaths` in
 * `share.ts` is spread from `workspacePaths` and a new screen there would change
 * the public share surface.
 */
export type DetailType = "car" | "city" | "playbook";

export type AppRoute = {
  accountView?: AccountView;
  detailSlug?: string;
  detailType?: DetailType;
  nav: string;
  openComposer?: boolean;
  screen: WorkspaceScreen;
};

/** Which workspace screen a detail route renders inside of. */
export const detailScreens: Record<DetailType, Exclude<WorkspaceScreen, "account">> = {
  car: "shortlist",
  city: "community",
  playbook: "community",
};

export const detailPathPrefixes: Record<DetailType, string> = {
  car: "/cars",
  city: "/cities",
  playbook: "/playbooks",
};

/** Same shape `share.ts` validates against: lowercase alphanumerics and single dashes. */
const detailSlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

export const detailSlugFromPath = (pathname: string, type: DetailType): string | null => {
  const prefix = `${detailPathPrefixes[type]}/`;
  if (!pathname.startsWith(prefix)) return null;
  const raw = pathname.slice(prefix.length);
  if (!raw || raw.includes("/")) return null;
  let slug = raw;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return detailSlugPattern.test(slug) ? slug : null;
};

/** `/cars/:slug`, `/cities/:slug`, `/playbooks/:slug` → a detail route, else null. */
export const detailRouteFromPath = (pathname: string): AppRoute | null => {
  const types: DetailType[] = ["car", "city", "playbook"];
  for (const type of types) {
    const slug = detailSlugFromPath(pathname, type);
    if (!slug) continue;
    const screen = detailScreens[type];
    return { detailSlug: slug, detailType: type, nav: screen, screen };
  }
  return null;
};

export const detailPathFor = (type: DetailType, slug: string): string =>
  `${detailPathPrefixes[type]}/${slug}`;

export const workspaceHashes: Record<Exclude<WorkspaceScreen, "account">, string> = {
  analytics: "#analytics",
  community: "#feed",
  creators: "#creators",
  garage: "#garage",
  home: "#top",
  kyv: "#kyv",
  shortlist: "#shortlist",
  vault: "#vault",
};

export const accountHashes: Record<AccountView, string> = {
  following: "#following",
  notifications: "#notifications",
  profile: "#profile",
  saved: "#saved",
  settings: "#settings",
};

export const workspacePaths: Record<Exclude<WorkspaceScreen, "account">, string> = {
  analytics: "/analytics",
  community: "/community",
  creators: "/creators",
  garage: "/garage",
  home: "/",
  kyv: "/kyv",
  shortlist: "/shortlist",
  vault: "/vault",
};

export const accountPaths: Record<AccountView, string> = {
  following: "/profile/following",
  notifications: "/profile/notifications",
  profile: "/profile",
  saved: "/profile/saved",
  settings: "/profile/settings",
};

export const routeFromPath = (pathname: string): AppRoute => {
  const detailRoute = detailRouteFromPath(pathname);
  if (detailRoute) return detailRoute;
  if (pathname === "/shortlist") return { nav: "shortlist", screen: "shortlist" };
  if (pathname === "/garage") return { nav: "garage", screen: "garage" };
  if (pathname === "/kyv") return { nav: "kyv", screen: "kyv" };
  if (pathname === "/vault") return { nav: "vault", screen: "vault" };
  if (pathname === "/analytics") return { nav: "analytics", screen: "analytics" };
  if (pathname === "/creators") return { nav: "creators", screen: "creators" };
  if (pathname === "/community/new") return { nav: "community", openComposer: true, screen: "community" };
  if (pathname.startsWith("/community")) return { nav: "community", screen: "community" };
  if (pathname === "/profile/saved") return { accountView: "saved", nav: "account", screen: "account" };
  if (pathname === "/profile/following") return { accountView: "following", nav: "account", screen: "account" };
  if (pathname === "/profile/notifications") return { accountView: "notifications", nav: "account", screen: "account" };
  if (pathname === "/profile/settings") return { accountView: "settings", nav: "account", screen: "account" };
  if (pathname === "/profile") return { accountView: "profile", nav: "account", screen: "account" };
  if (pathname === "/moderation") return { nav: "account", screen: "account" };
  return { nav: "home", screen: "home" };
};

export const titleForPath = (pathname: string): string => {
  const detailRoute = detailRouteFromPath(pathname);
  if (detailRoute?.detailType === "car") return "Model dossier · Autoflex";
  if (detailRoute?.detailType === "city") return "City circle · Autoflex";
  if (detailRoute?.detailType === "playbook") return "Ownership playbook · Autoflex";
  if (pathname.startsWith("/community/")) return pathname === "/community/new" ? "Write an owner note · Autoflex" : "Owner note · Autoflex";
  if (pathname === "/community") return "Owner notes · Autoflex";
  if (pathname === "/shortlist") return "Shortlist · Autoflex";
  if (pathname === "/garage") return "Garage · Autoflex";
  if (pathname === "/kyv") return "Know Your Vehicle · Autoflex";
  if (pathname === "/vault") return "Document Vault · Autoflex";
  if (pathname === "/analytics") return "Analytics · Autoflex";
  if (pathname === "/creators") return "Creator Connect · Autoflex";
  if (pathname.startsWith("/profile")) return "Profile · Autoflex";
  if (pathname === "/moderation") return "Moderation · Autoflex";
  return "Today · Autoflex";
};

export const routeFromHash = (hash: string): AppRoute => {
  switch (hash.toLowerCase()) {
    case "#shortlist":
    case "#notebooks":
      return { nav: "shortlist", screen: "shortlist" };
    case "#garage":
      return { nav: "garage", screen: "garage" };
    case "#feed":
      return { nav: "community", screen: "community" };
    case "#write":
      return { nav: "community", openComposer: true, screen: "community" };
    case "#saved":
      return { accountView: "saved", nav: "home", screen: "account" };
    case "#following":
      return { accountView: "following", nav: "home", screen: "account" };
    case "#notifications":
      return { accountView: "notifications", nav: "home", screen: "account" };
    case "#settings":
      return { accountView: "settings", nav: "home", screen: "account" };
    case "#profile":
      return { accountView: "profile", nav: "home", screen: "account" };
    default:
      return { nav: "home", screen: "home" };
  }
};

export const getInitialRoute = (): AppRoute =>
  routeFromHash(typeof window === "undefined" ? "" : window.location.hash);
