import { describe, expect, it } from "vitest";
import {
  applyThemePreference, nextThemePreference, readThemePreference, saveThemePreference, themePreferences,
} from "./theme";

const memoryStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

// Just enough of a document for applyThemePreference: a root element, a head, one meta lookup.
const fakeDocument = () => {
  const attributes = new Map<string, string>();
  const metas: Array<Map<string, string>> = [];
  const element = (store: Map<string, string>) => ({
    setAttribute: (name: string, value: string) => { store.set(name, value); },
    removeAttribute: (name: string) => { store.delete(name); },
    remove: () => { metas.splice(metas.indexOf(store), 1); },
  });
  const doc = {
    documentElement: element(attributes),
    head: { prepend: (meta: { store: Map<string, string> }) => { metas.unshift(meta.store); } },
    createElement: () => { const store = new Map<string, string>(); return { ...element(store), store }; },
    querySelector: () => {
      const store = metas.find(meta => meta.has("data-theme-override"));
      return store ? element(store) : null;
    },
  };
  return { doc: doc as unknown as Parameters<typeof applyThemePreference>[1], attributes, metas };
};

describe("theme preference", () => {
  it("cycles system, light, dark and back", () => {
    expect(themePreferences.map(nextThemePreference)).toEqual(["light", "dark", "system"]);
  });

  it("falls back to system for a missing, unknown or unreadable stored value", () => {
    expect(readThemePreference(memoryStorage())).toBe("system");
    expect(readThemePreference(memoryStorage({ "otofolks.theme": "sepia" }))).toBe("system");
    expect(readThemePreference(null)).toBe("system");
    expect(readThemePreference({ getItem: () => { throw new Error("blocked"); }, setItem: () => {}, removeItem: () => {} }))
      .toBe("system");
  });

  it("stores an explicit choice and forgets it when set back to system", () => {
    const storage = memoryStorage();
    saveThemePreference("dark", storage);
    expect(readThemePreference(storage)).toBe("dark");
    saveThemePreference("system", storage);
    expect(storage.values.size).toBe(0);
    expect(() => saveThemePreference("light", { getItem: () => null, setItem: () => { throw new Error("full"); }, removeItem: () => {} }))
      .not.toThrow();
  });

  it("sets data-theme and one browser-chrome colour for an explicit choice, and clears both for system", () => {
    const { doc, attributes, metas } = fakeDocument();
    applyThemePreference("dark", doc);
    expect(attributes.get("data-theme")).toBe("dark");
    expect(metas).toHaveLength(1);
    expect(metas[0].get("content")).toBe("#222b3d");

    applyThemePreference("light", doc);
    expect(attributes.get("data-theme")).toBe("light");
    expect(metas).toHaveLength(1);
    expect(metas[0].get("content")).toBe("#faf8f3");

    applyThemePreference("system", doc);
    expect(attributes.has("data-theme")).toBe(false);
    expect(metas).toHaveLength(0);
  });
});
