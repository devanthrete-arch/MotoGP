import type { ComponentProps, CSSProperties, HTMLAttributes } from "react";
import { cx } from "./cx";

export type GlassCardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "aside" | "li";
  /** glass: the default card. sunken: a quiet inset. band: the slate feature band, same in both themes. */
  tone?: "glass" | "sunken" | "band";
  /** Drop the padding when the content brings its own (a list, an image, a table). */
  flush?: boolean;
};

/** A card. Do not put a glass card inside a glass card; use tone="sunken" for the inner one. */
export function GlassCard({ as: Tag = "div", tone = "glass", flush = false, className, ...rest }: GlassCardProps) {
  return <Tag {...rest} className={cx("ui-card", `ui-card--${tone}`, flush && "ui-card--flush", className)} />;
}

export type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent";
  /** Mono face and lined-up digits, for specs and prices. */
  mono?: boolean;
};

/** A small label. Not interactive; use ToggleChip for a filter. */
export function Chip({ tone = "neutral", mono = false, className, ...rest }: ChipProps) {
  return <span {...rest} className={cx("ui-chip", tone === "accent" && "ui-chip--accent", mono && "ui-chip--mono", className)} />;
}

export type ToggleChipProps = Omit<ComponentProps<"button">, "aria-pressed"> & { pressed: boolean };

/** A filter pill that is on or off. */
export function ToggleChip({ pressed, className, type = "button", ...rest }: ToggleChipProps) {
  return <button {...rest} type={type} aria-pressed={pressed} className={cx("ui-chip", "ui-chip--toggle", className)} />;
}

export type SkeletonProps = {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  shape?: "block" | "pill" | "circle";
  className?: string;
};

/** Placeholder for content that is loading. Hidden from screen readers; pair it with a status message. */
export function Skeleton({ width = "100%", height = 16, shape = "block", className }: SkeletonProps) {
  return <span aria-hidden="true" style={{ width, height }}
    className={cx("ui-skeleton", shape !== "block" && `ui-skeleton--${shape}`, className)} />;
}
