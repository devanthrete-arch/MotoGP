import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "./cn";
import { GhostButton, LabelCaps } from "./primitives";

/**
 * A failed *hosted* read, reported without taking the screen away.
 *
 * The shape of this component is dictated by the data layer. AutoFlex's hosted
 * calls return a `HostedResult` whose failure arm still carries `data` — the
 * local snapshot. So a failed refresh is never a dead end: the owner is still
 * looking at their real garage, their real shortlist, their real notes. The
 * correct UX for that is a quiet inline notice next to content that is still
 * usable, *not* a full-screen error that throws away a working screen because
 * a network round trip lost.
 *
 * Consequences of that, all deliberate:
 * - `role="status"` with `aria-live="polite"`, never `role="alert"`. Nothing is
 *   broken and nothing needs interrupting; the notice waits its turn.
 * - The retry action is optional and secondary. Doing nothing is a valid
 *   response, because the screen already works.
 * - Colour is not the signal. The notice leads with a labelled icon and the
 *   word-level heading, so it reads the same in greyscale.
 *
 * `variant="banner"` is the full-bleed strip used for the app-level offline
 * notice, where the message spans the whole workspace rather than one panel.
 */
export type ErrorStateProps = {
  /** Short label for what failed. Defaults to a generic sync heading. */
  title?: ReactNode;
  /** The user-facing explanation. Required — a notice with no message is noise. */
  message: ReactNode;
  /** Optional retry. Omit it when the app retries on its own. */
  onRetry?: () => void;
  /** Label for the retry control. */
  retryLabel?: string;
  variant?: "inline" | "banner";
  className?: string;
  id?: string;
};

export function ErrorState({
  title = "Showing your saved copy",
  message,
  onRetry,
  retryLabel = "Try again",
  variant = "inline",
  className,
  id,
}: ErrorStateProps) {
  if (variant === "banner") {
    return (
      <div className={cn("offline-banner", className)} id={id} role="status">
        {message}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-3 border border-outline-variant bg-surface-container-low rounded-lg px-4 py-3 text-sm text-on-surface-variant",
        className,
      )}
      id={id}
      role="status"
    >
      <TriangleAlert aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 text-error" />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <LabelCaps className="text-on-surface">{title}</LabelCaps>
        <p className="min-w-0">{message}</p>
      </div>
      {onRetry ? (
        <GhostButton className="shrink-0" onClick={onRetry}>
          {retryLabel}
        </GhostButton>
      ) : null}
    </div>
  );
}
