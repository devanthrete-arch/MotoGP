import type { ComponentPropsWithRef, CSSProperties } from "react";
import { cn } from "./cn";

/**
 * Placeholder geometry for content that has been requested but not arrived.
 *
 * Why this exists in a local-first app: first paint never waits, because every
 * screen renders from `localStorage`. But a *hosted* read — a feed page, a
 * comment thread, a city page — resolves later, and on a low-end Android phone
 * the gap is long enough to see. A skeleton is only correct if it occupies the
 * same box the real content will, otherwise it trades a blank for a jump, so
 * `Skeleton` takes explicit dimensions rather than guessing.
 *
 * Motion: the shimmer is `motion-safe:` only. Under `prefers-reduced-motion:
 * reduce` the shape still renders, it just holds still — the layout guarantee
 * is the point, the animation is decoration.
 *
 * Skeletons are `aria-hidden`. They carry no information; the announcement is
 * the job of the surrounding live region (see `AsyncBoundary`).
 */
export type SkeletonProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
  /** Visual shape. `text` is a rounded line, `circle` is an avatar slot. */
  variant?: "block" | "text" | "circle";
  /** Any CSS length. Defaults to full width of the parent. */
  width?: string;
  /** Any CSS length. Defaults to the variant's natural height. */
  height?: string;
};

const variantClasses: Record<NonNullable<SkeletonProps["variant"]>, string> = {
  block: "rounded",
  text: "rounded-full h-3",
  circle: "rounded-full",
};

export function Skeleton({ variant = "block", width, height, className, style, ...rest }: SkeletonProps) {
  const sizing: CSSProperties = { ...style };
  if (width) sizing.width = width;
  if (height) sizing.height = height;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-surface-container-high motion-safe:animate-pulse",
        variantClasses[variant],
        !width && variant !== "circle" ? "w-full" : undefined,
        className,
      )}
      data-skeleton={variant}
      style={sizing}
      {...rest}
    />
  );
}

/**
 * A paragraph-shaped run of skeleton lines.
 *
 * The last line is short, because real prose rarely fills its final line and a
 * block of identical bars reads as a table rather than as text.
 */
export function SkeletonText({
  lines = 3,
  className,
  ...rest
}: Omit<ComponentPropsWithRef<"div">, "children"> & { lines?: number }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2", className)} {...rest}>
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <Skeleton key={index} variant="text" width={index === lines - 1 && lines > 1 ? "60%" : undefined} />
      ))}
    </div>
  );
}

/**
 * A skeleton shaped like a `Card` holding an avatar row and a short note.
 *
 * This is the feed/list placeholder. It reuses the card's own border, radius
 * and padding, so swapping the real card in changes no box on the page.
 */
export function SkeletonCard({
  lines = 2,
  className,
  ...rest
}: Omit<ComponentPropsWithRef<"div">, "children"> & { lines?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden bg-surface-container border border-outline-variant rounded-lg p-4 flex flex-col gap-3",
        className,
      )}
      {...rest}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" width="2.5rem" height="2.5rem" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="25%" />
        </div>
      </div>
      <SkeletonText lines={lines} />
    </div>
  );
}

/** `count` stacked `SkeletonCard`s, for a list placeholder. */
export function SkeletonList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-4", className)}>
      {Array.from({ length: Math.max(1, count) }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
