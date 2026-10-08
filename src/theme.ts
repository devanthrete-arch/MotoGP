// Light / dark theme choice. "system" follows the device; an explicit choice sets data-theme on
// <html>, which src/styles/tokens.css reads. The choice is kept per device, not per account, so
// it applies before sign-in.

export type ThemePreference = "system" | "light" | "dark";

export const themePreferences: readonly ThemePreference[] = ["system", "light", "dark"];
export const themeLabels: Record<ThemePreference, string> = { system: "System", light: "Light", dark: "Dark" };

const storageKey = "otofolks.theme";
// Matches --color-bg in src/styles/tokens.css, for the browser chrome around the page.
const chromeColors = { light: "#faf8f3", dark: "#222b3d" } as const;

type ThemeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type ThemeDocument = Pick<Document, "documentElement" | "head" | "querySelector" | "createElement">;

const browserStorage = (): ThemeStorage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export const isThemePreference = (value: unknown): value is ThemePreference =>
  typeof value === "string" && (themePreferences as readonly string[]).includes(value);

export const nextThemePreference = (current: ThemePreference): ThemePreference =>
  themePreferences[(themePreferences.indexOf(current) + 1) % themePreferences.length];

export function readThemePreference(storage: ThemeStorage | null = browserStorage()): ThemePreference {
  try {
    const stored = storage?.getItem(storageKey);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function saveThemePreference(preference: ThemePreference, storage: ThemeStorage | null = browserStorage()): void {
  try {
    if (preference === "system") storage?.removeItem(storageKey);
    else storage?.setItem(storageKey, preference);
  } catch {
    // Storage can be blocked or full; the choice still applies for this visit.
  }
}

// One preference for the whole page. Components read it with useSyncExternalStore, so two theme
// switches never disagree, and a change in another tab arrives through the storage event.
const listeners = new Set<() => void>();
let current: ThemePreference | null = null;

export const themeStore = {
  get: (): ThemePreference => (current ??= readThemePreference()),
  set(preference: ThemePreference): void {
    current = preference;
    saveThemePreference(preference);
    applyThemePreference(preference);
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void): () => void {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== storageKey) return;
      current = readThemePreference();
      listener();
    };
    listeners.add(listener);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};

export function applyThemePreference(preference: ThemePreference, doc: ThemeDocument = document): void {
  const root = doc.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);

  // index.html carries media-matched theme-color metas for the system setting. An explicit
  // choice adds one without a media query, which browsers prefer; "system" removes it again.
  const override = doc.querySelector('meta[name="theme-color"][data-theme-override]');
  if (preference === "system") {
    override?.remove();
    return;
  }
  const meta = override ?? doc.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("data-theme-override", "");
  meta.setAttribute("content", chromeColors[preference]);
  if (!override) doc.head.prepend(meta);
}
