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
