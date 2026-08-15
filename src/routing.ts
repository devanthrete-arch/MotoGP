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

export type AppRoute = {
  accountView?: AccountView;
  nav: string;
  openComposer?: boolean;
  screen: WorkspaceScreen;
};

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
