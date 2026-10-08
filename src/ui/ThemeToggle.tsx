import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import type { Ref } from "react";
import { applyThemePreference, nextThemePreference, themeLabels, themeStore } from "../theme";
import { cx } from "./cx";

const icons = { system: Monitor, light: Sun, dark: Moon };

export type ThemeToggleProps = {
  /** header: for the dark header bar, which is dark in both themes. */
  tone?: "surface" | "header";
  className?: string;
  ref?: Ref<HTMLButtonElement>;
};

/** One button that steps through System, Light and Dark, and remembers the choice on this device. */
export function ThemeToggle({ tone = "surface", className, ref }: ThemeToggleProps) {
  // Shared store, so every toggle on the page (and in other tabs) shows the same choice.
  const preference = useSyncExternalStore(themeStore.subscribe, themeStore.get, () => "system" as const);
  useEffect(() => { applyThemePreference(preference); }, [preference]);
  const next = nextThemePreference(preference);
  const Icon = icons[preference];
  return (
    <button ref={ref} className={cx("ui-theme-toggle", tone === "header" && "ui-theme-toggle--header", className)}
      type="button" title="Switch theme"
      aria-label={`Theme: ${themeLabels[preference]}. Switch to ${themeLabels[next]}`}
      onClick={() => themeStore.set(next)}>
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
