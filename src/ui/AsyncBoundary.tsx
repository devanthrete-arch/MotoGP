import type { ReactNode } from "react";
import { cn } from "./cn";
import { ErrorState } from "./ErrorState";
import { SkeletonList } from "./Skeleton";

/**
 * The four-way loading / error / empty / content branch, in one place.
 *
 * Every screen was hand-rolling some subset of this and getting a different
 * subset right. `AsyncBoundary` fixes the policy once, and the policy is
 * local-first:
 *
 *   1. Loading with nothing to show  -> skeleton. This is the only case where a
 *      spinner-shaped thing is correct: there is genuinely no local data.
 *   2. Loading with something to show -> the content, marked `aria-busy`. A
 *      background refresh must never blank out records the owner already has.
 *      This is the rule the app exists to keep, so it is enforced here rather
 *      than left to each screen to remember.
 *   3. Failed with local data        -> the content, with a quiet `ErrorState`
 *      above it. Never a blocking error: the hosted failure arm always carries
 *      the local snapshot.
 *   4. Empty and settled            -> the `empty` slot.
 *
 * Note the ordering: `loading` and `error` are evaluated against whether there
 * is anything to render, not on their own. A screen cannot accidentally show an
 * empty state during the first load, or an error page over usable data.
 *
 * The boundary owns one polite live region so a screen reader hears "loading"
 * and then the settled result, without every screen wiring its own.
 */
export type AsyncBoundaryProps = {
  /** A hosted read is in flight. */
  loading?: boolean;
  /** A hosted read failed. The message is shown inline over the local data. */
  error?: { message: string; title?: string; onRetry?: () => void } | null;
  /** There is no content to render — drives the `empty` slot. */
  isEmpty?: boolean;
  /** Placeholder for the first load. Defaults to a three-card list skeleton. */
  skeleton?: ReactNode;
  /** What to show when the read settled with nothing in it. */
  empty?: ReactNode;
  /**
   * What this boundary is loading, for the announcement — e.g. "Owner notes".
   * Also becomes the skeleton's accessible status text.
   */
  label?: string;
  className?: string;
  children: ReactNode;
};

export function AsyncBoundary({
  loading = false,
  error = null,
  isEmpty = false,
  skeleton,
  empty,
  label,
  className,
  children,
}: AsyncBoundaryProps) {
  const showSkeleton = loading && isEmpty;
  const showEmpty = !loading && isEmpty && !!empty;
  const busy = loading && !isEmpty;

  return (
    // One wrapper, and `children` render as a direct child of it: an extra
    // element around the content would break a grid or flex parent, and
    // mounting/unmounting a wrapper as `busy` flips would remount the subtree
    // and drop focus. Place the boundary *around* a list container, never
    // inside one as a sibling of the items.
    <div
      aria-busy={loading || undefined}
      className={cn(busy && "motion-safe:opacity-70 transition-opacity", className)}
    >
      <p className="sr-only" role="status">
        {loading ? `Loading ${label ?? "content"}…` : ""}
      </p>
      {error && !showSkeleton ? (
        <ErrorState className="mb-4" message={error.message} onRetry={error.onRetry} title={error.title} />
      ) : null}
      {showSkeleton ? (skeleton ?? <SkeletonList />) : showEmpty ? empty : children}
    </div>
  );
}
