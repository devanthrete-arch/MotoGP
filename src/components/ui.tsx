import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

/*
 * Obsidian Velocity shared UI primitives.
 *
 * Class conventions (use these when restyling screens):
 * - label-caps microcopy: "font-mono text-[10px] font-bold tracking-[0.2em] uppercase"
 * - data readouts:        "font-mono text-xs tracking-[0.1em]" (sm) / "font-mono text-xl font-medium tracking-[0.05em]" (lg)
 * - cards:                "bg-surface-container border border-outline-variant rounded-lg"
 * - card edge highlight:  add <EdgeGlow /> as first child of a relative card
 * - primary action glow:  "shadow-[0_0_15px_rgba(199,198,203,0.3)]"
 */

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export function LabelCaps({ className = "", children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx("font-mono text-[10px] font-bold leading-3 tracking-[0.2em] uppercase", className)} {...rest}>
      {children}
    </span>
  );
}

export function DataText({ size = "sm", className = "", children, ...rest }: HTMLAttributes<HTMLSpanElement> & { size?: "sm" | "lg" }) {
  return (
    <span
      className={cx(
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

export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("relative overflow-hidden bg-surface-container border border-outline-variant rounded-lg p-4", className)} {...rest}>
      <EdgeGlow />
      {children}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  detail,
  actions,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-4 mb-4", className)}>
      <div>
        {eyebrow ? <LabelCaps className="text-primary block mb-1">{eyebrow}</LabelCaps> : null}
        <h2 className="font-display text-2xl font-semibold tracking-tight text-on-surface uppercase">{title}</h2>
        {detail ? <p className="text-sm text-on-surface-variant mt-1">{detail}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Badge({ tone = "default", className = "", children, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "primary" | "error" | "tertiary" }) {
  const tones: Record<string, string> = {
    default: "bg-surface-variant text-on-surface-variant",
    primary: "bg-primary text-on-primary",
    error: "bg-error-container text-on-error-container",
    tertiary: "bg-tertiary-container text-tertiary",
  };
  return (
    <span
      className={cx(
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

/** Status chip, e.g. "SYS.RDY", "DRIVE", "PARK". Monochrome unless error. */
export function StatusChip({ on = true, error = false, className = "", children, ...rest }: HTMLAttributes<HTMLSpanElement> & { on?: boolean; error?: boolean }) {
  return (
    <span
      className={cx(
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
        className={cx(
          "w-1.5 h-1.5 rounded-full",
          error ? "bg-error shadow-[0_0_6px_rgba(255,180,171,0.7)]" : on ? "bg-primary shadow-[0_0_6px_rgba(199,198,203,0.7)]" : "bg-outline-variant",
        )}
      />
      {children}
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({ className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-mono text-[10px] font-bold tracking-[0.2em] uppercase px-5 py-3 rounded shadow-[0_0_15px_rgba(199,198,203,0.25)] transition-transform active:scale-95 disabled:opacity-50",
        className,
      )}
      type="button"
      {...rest}
    >
      {children}
    </button>
  );
}

export function GhostButton({ className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 bg-transparent text-on-surface border border-outline-variant hover:border-outline font-mono text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-2.5 rounded transition-colors disabled:opacity-50",
        className,
      )}
      type="button"
      {...rest}
    >
      {children}
    </button>
  );
}

export function EmptyState({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "flex flex-col items-start gap-3 border border-dashed border-outline-variant rounded-lg p-5 text-outline text-sm",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
