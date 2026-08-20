import { useEffect, type RefObject } from "react";

/** Everything that can hold focus inside an overlay, in DOM order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Deliberately does not probe layout for visibility: the trap is only ever
 * active while the overlay is open, and a layout read here would force a reflow
 * on every Tab on exactly the devices this app targets.
 */
const focusableWithin = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.getAttribute("aria-hidden") !== "true" && !element.hasAttribute("hidden"),
  );

/**
 * Keeps Tab inside an open overlay, and optionally closes it on Escape.
 *
 * Why a hook rather than a `<Dialog>` component: the app's overlays (the
 * vehicle menu, the composers) are already positioned and styled by the screen
 * that owns them, and their open/closed state lives in the app store together
 * with the trigger ref used to restore focus. Wrapping them in a new container
 * component would move DOM around; a hook adds only the behaviour that was
 * missing, which is that Tab used to walk straight out of an open menu and
 * leave the keyboard user stranded behind an overlay they could not see.
 *
 * `onEscape` is optional so this can be layered on top of an existing Escape
 * handler without double-closing.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options: { onEscape?: () => void } = {},
): void {
  const { onEscape } = options;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onEscape) {
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableWithin(container);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      // Focus escaped the container entirely (or never entered it): pull it back.
      if (!activeElement || !container.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
        return;
      }
      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last?.focus();
        return;
      }
      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [active, containerRef, onEscape]);
}
