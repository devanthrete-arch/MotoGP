import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { cx } from "./cx";

type Look = {
  /** primary: the one main action in view. secondary: everything else. ghost: low-emphasis, inline. */
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
};

const buttonClass = ({ variant = "secondary", size = "md", fullWidth }: Look, extra?: string) =>
  cx("ui-button", `ui-button--${variant}`, size === "sm" && "ui-button--sm", fullWidth && "ui-button--full", extra);

export type ButtonProps = Look & ComponentProps<"button"> & {
  /** Work is in progress: shows a spinner and ignores presses, but keeps keyboard focus on the button. */
  busy?: boolean;
};

export function Button({
  variant, size, icon, trailingIcon, fullWidth, busy = false, className, children, type = "button", onClick, ...rest
}: ButtonProps) {
  return (
    <button {...rest} type={type} className={buttonClass({ variant, size, fullWidth }, className)}
      // Not the disabled attribute: that would drop focus to the page and silence the busy state.
      aria-disabled={busy || undefined} aria-busy={busy || undefined}
      onClick={busy ? (event: MouseEvent<HTMLButtonElement>) => event.preventDefault() : onClick}>
      {busy ? <span className="ui-button__spinner" aria-hidden="true" /> : icon}
      <span className="ui-button__label">{children}</span>
      {trailingIcon}
    </button>
  );
}

export type LinkButtonProps = Look & ComponentProps<"a"> & { href: string };

/** A link that looks like a button, for navigation. Use Button for actions. */
export function LinkButton({ variant, size, icon, trailingIcon, fullWidth, className, children, ...rest }: LinkButtonProps) {
  return (
    <a {...rest} className={buttonClass({ variant, size, fullWidth }, className)}>
      {icon}
      <span className="ui-button__label">{children}</span>
      {trailingIcon}
    </a>
  );
}

export type IconButtonProps = Omit<ComponentProps<"button">, "aria-label" | "title"> & {
  /** Read by screen readers and shown as the tooltip; the icon alone says nothing. */
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
};

export function IconButton({ label, variant = "secondary", size = "md", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button {...rest} type={type} aria-label={label} title={label}
      className={cx("ui-icon-button", `ui-button--${variant}`, size === "sm" && "ui-icon-button--sm", className)}>
      {children}
    </button>
  );
}
