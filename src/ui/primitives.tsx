import type { ComponentPropsWithRef, ComponentType, ReactNode } from "react";
import { cn, focusRing, touchTarget } from "./cn";

/*
 * Obsidian Velocity shared UI primitives.
 *
 * Conventions every primitive in this folder follows — see docs/UI_SYSTEM.md:
 * - `className` is always merged through `cn()`, never concatenated.
 * - Props extend the underlying element's props, so `id`, `aria-*`, `data-*`,
 *   `onClick` and `ref` all pass through without the primitive knowing about
 *   them. `ref` is a plain prop (React 19); no `forwardRef` wrapper is needed.
 * - Interactive primitives carry `focusRing` and the 44px touch floor.
 * - Colour is never the only signal: every tone also changes text or an icon.
 *
 * Class conventions (use these when restyling screens):
 * - label-caps microcopy: "font-mono text-[10px] font-bold tracking-[0.2em] uppercase"
 * - data readouts:        "font-mono text-xs tracking-[0.1em]" (sm) / "font-mono text-xl font-medium tracking-[0.05em]" (lg)
 * - cards:                "bg-surface-container border border-outline-variant rounded-lg"
 * - card edge highlight:  add <EdgeGlow /> as first child of a relative card
 * - primary action glow:  "shadow-[0_0_15px_rgba(199,198,203,0.3)]"
 */

/** An icon component in the shape lucide-react exports. */
export type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/** Microcopy in the label-caps role: section eyebrows, field labels, chips. */
export function LabelCaps({ className, children, ...rest }: ComponentPropsWithRef<"span">) {
  return (
    <span className={cn("font-mono text-[10px] font-bold leading-3 tracking-[0.2em] uppercase", className)} {...rest}>
      {children}
    </span>
  );
}

/**
 * A numeric or machine-ish readout (odometer, cost, status stamp).
 *
 * Kept distinct from body text on purpose: owners scan these values rather than
 * read them, and the mono face keeps digits from reflowing as they change.
 */
export function DataText({
  size = "sm",
  className,
  children,
  ...rest
}: ComponentPropsWithRef<"span"> & { size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "font-mono",
        size === "lg" ? "text-xl font-medium leading-7 tracking-[0.05em]" : "text-xs leading-4 tracking-[0.1em]",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/** 1px top-border light highlight for glass cards (template pattern). */
export function EdgeGlow() {
  return <div aria-hidden="true" className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />;
}

/** The standard surface container: bordered, padded, edge-lit. */
export function Card({ className, children, ...rest }: ComponentPropsWithRef<"div">) {
  return (
    <div className={cn("relative overflow-hidden bg-surface-container border border-outline-variant rounded-lg p-5", className)} {...rest}>
      <EdgeGlow />
      {children}
    </div>
  );
}

/**
 * Eyebrow + heading + supporting line, with optional trailing actions.
 *
 * `titleAs` exists because the same visual header appears both directly under
 * the screen `h2` and nested a level deeper; the heading outline has to follow
 * the document, not the design.
 */
export function SectionHeader({
  eyebrow,
  title,
  titleAs: TitleTag = "h2",
  detail,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  titleAs?: "h2" | "h3" | "h4";
  detail?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 mb-5", className)}>
      <div>
        {eyebrow ? <LabelCaps className="text-primary block mb-1">{eyebrow}</LabelCaps> : null}
        <TitleTag className="font-display text-2xl font-semibold tracking-tight text-on-surface uppercase">{title}</TitleTag>
        {detail ? <p className="text-sm text-on-surface-variant mt-1.5">{detail}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Non-interactive category marker (note type, shortlist status). */
export function Badge({
  tone = "default",
  className,
  children,
  ...rest
}: ComponentPropsWithRef<"span"> & { tone?: "default" | "primary" | "error" | "tertiary" }) {
  const tones: Record<string, string> = {
    default: "bg-surface-variant text-on-surface-variant",
    primary: "bg-primary text-on-primary",
    error: "bg-error-container text-on-error-container",
    tertiary: "bg-tertiary-container text-tertiary",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded font-mono text-[10px] font-bold tracking-[0.2em] uppercase",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/**
 * Status chip, e.g. "SYS.RDY", "DRIVE", "PARK". Monochrome unless error.
 *
 * The dot is `aria-hidden` and decorative *by design*: the state is always
 * spelled out in the children, so the chip still reads correctly to a screen
 * reader, in a screenshot, and to anyone who cannot separate the two dot
 * colours. `children` is required for that reason.
 */
export function StatusChip({
  on = true,
  error = false,
  className,
  children,
  ...rest
}: Omit<ComponentPropsWithRef<"span">, "children"> & { on?: boolean; error?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded border font-mono text-[10px] font-bold tracking-[0.2em] uppercase",
        error
          ? "border-error/40 bg-error-container/40 text-error"
          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          error ? "bg-error shadow-[0_0_6px_rgba(255,180,171,0.7)]" : on ? "bg-primary shadow-[0_0_6px_rgba(199,198,203,0.7)]" : "bg-outline-variant",
        )}
      />
      {children}
    </span>
  );
}

type ButtonProps = ComponentPropsWithRef<"button">;

/**
 * The filled action. One per surface, for the thing the screen is asking for.
 *
 * `tone="danger"` is the same button in the error container colours — used for
 * destructive confirmations, which must stay a *filled* action so they are not
 * mistaken for a link. `type="button"` is set before the spread so a caller can
 * still pass `type="submit"`.
 */
export function PrimaryButton({ className, tone = "primary", children, ...rest }: ButtonProps & { tone?: "primary" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2",
        touchTarget,
        tone === "danger"
          ? "bg-error-container text-on-error-container"
          : "bg-primary text-on-primary shadow-[0_0_15px_rgba(199,198,203,0.25)]",
        "font-mono text-[10px] font-bold tracking-[0.2em] uppercase px-5 py-3 rounded transition-transform active:scale-95 disabled:opacity-50",
        focusRing,
        className,
      )}
      type="button"
      {...rest}
    >
      {children}
    </button>
  );
}

/** The outlined action: secondary, repeatable, and safe to have many of. */
export function GhostButton({ className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2",
        touchTarget,
        "bg-transparent text-on-surface border border-outline-variant hover:border-outline font-mono text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-2.5 rounded transition-colors disabled:opacity-50",
        focusRing,
        className,
      )}
      type="button"
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * A square icon-only control at the 44px touch floor.
 *
 * `label` is required, not optional: an icon button with no accessible name is
 * the single most common a11y defect in this codebase's history, so the type
 * system refuses to let one be built.
 */
export function IconButton({
  icon: Icon,
  label,
  className,
  ...rest
}: Omit<ButtonProps, "children" | "aria-label"> & { icon: IconComponent; label: string }) {
  return (
    <button
      aria-label={label}
      className={cn(
        "w-11 h-11 shrink-0 inline-flex items-center justify-center rounded text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50",
        focusRing,
        className,
      )}
      type="button"
      {...rest}
    >
      <Icon aria-hidden="true" className="w-4 h-4" />
    </button>
  );
}

/**
 * A pressed/unpressed filter or mode control.
 *
 * Wraps the `aria-pressed` contract so a toggle can never ship as a plain
 * button, and keeps the pressed state readable without colour: pressed swaps
 * the fill *and* the border, and callers are expected to keep the label honest.
 */
export function ToggleChip({
  pressed,
  className,
  children,
  ...rest
}: Omit<ButtonProps, "aria-pressed"> & { pressed: boolean }) {
  return (
    <button
      aria-pressed={pressed}
      className={cn(
        "whitespace-nowrap inline-flex items-center justify-center gap-2",
        touchTarget,
        "px-4 py-3 rounded-full font-mono text-[10px] font-bold tracking-[0.2em] uppercase transition-colors",
        pressed
          ? "bg-primary text-on-primary shadow-[0_0_12px_rgba(199,198,203,0.4)]"
          : "bg-surface-container text-on-surface-variant border border-outline-variant hover:text-on-surface",
        focusRing,
        className,
      )}
      type="button"
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * The "there is nothing here yet" surface.
 *
 * An empty list is a product moment, not a blank: it says what would be here,
 * why it is worth having, and offers the one action that fills it. The API is
 * fixed (`icon` / `title` / `body` / `action` / `secondaryAction`) so every
 * empty state in the app has the same anatomy and the same reading order.
 *
 * `children` stays supported as an escape hatch for bespoke content, and
 * renders after `body`.
 */
export function EmptyState({
  icon: Icon,
  title,
  titleAs: TitleTag = "h3",
  body,
  action,
  secondaryAction,
  className,
  children,
  ...rest
}: Omit<ComponentPropsWithRef<"div">, "title"> & {
  icon?: IconComponent;
  title?: ReactNode;
  titleAs?: "h2" | "h3" | "h4" | "p";
  body?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 border border-dashed border-outline-variant rounded-lg p-5 text-on-surface-variant text-sm",
        className,
      )}
      {...rest}
    >
      {Icon ? (
        <span aria-hidden="true" className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center">
          <Icon className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
        </span>
      ) : null}
      {title ? (
        <TitleTag className="font-display text-base font-semibold uppercase tracking-tight text-on-surface">{title}</TitleTag>
      ) : null}
      {body ? <p>{body}</p> : null}
      {children}
      {action || secondaryAction ? (
        <div className="flex flex-wrap items-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One labelled metadata pair (e.g. "Fuel" / "Diesel").
 *
 * `muted` renders a value the app does not actually know — the placeholder is
 * deliberately dimmer than a recorded value so a reader can tell a fact from a
 * blank at a glance without reading the string.
 */
export function FactPair({
  label,
  value,
  muted = false,
  className,
  title,
}: {
  label: string;
  value: ReactNode;
  muted?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 min-w-0", className)} title={title}>
      <LabelCaps className="text-on-surface-variant">{label}</LabelCaps>
      <DataText className={cn("truncate", muted ? "text-outline" : "text-on-surface")}>{value}</DataText>
    </div>
  );
}
