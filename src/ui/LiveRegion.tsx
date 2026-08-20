import { cn } from "./cn";

/**
 * A polite announcer that is always in the DOM.
 *
 * The bug this fixes is subtle and was live in the app: the action toast was
 * mounted only while it had text. A live region inserted into the document at
 * the same moment as its content is frequently not announced at all — assistive
 * tech has to be observing the region *before* it changes. Keeping the element
 * mounted and swapping only its text makes every message announce exactly once,
 * on change, and never on an unrelated re-render.
 *
 * `hidden` controls the *visual* presence only; the region itself stays.
 */
export function LiveRegion({
  message,
  className,
  visible = true,
  atomic = true,
}: {
  /** Empty string means "nothing to say" — the region stays mounted and silent. */
  message: string;
  className?: string;
  /** When false the region is present for assistive tech but not painted. */
  visible?: boolean;
  atomic?: boolean;
}) {
  return (
    <div
      aria-atomic={atomic}
      aria-live="polite"
      className={cn(!message || !visible ? "sr-only" : className)}
      role="status"
    >
      {message}
    </div>
  );
}
