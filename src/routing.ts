export type WorkspaceScreen = "home" | "shortlist" | "garage" | "community" | "account";
export type AccountView = "profile" | "saved" | "following" | "notifications" | "settings";

export type AppRoute = {
  accountView?: AccountView;
  nav: string;
  openComposer?: boolean;
  screen: WorkspaceScreen;
};

export const workspaceHashes: Record<Exclude<WorkspaceScreen, "account">, string> = {
  community: "#feed",
  garage: "#garage",
  home: "#top",
  shortlist: "#shortlist",
};

export const accountHashes: Record<AccountView, string> = {
  following: "#following",
  notifications: "#notifications",
  profile: "#profile",
  saved: "#saved",
  settings: "#settings",
};

export const workspacePaths: Record<Exclude<WorkspaceScreen, "account">, string> = {
  community: "/community",
  garage: "/garage",
  home: "/",
  shortlist: "/shortlist",
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
