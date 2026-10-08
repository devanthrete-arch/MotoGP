import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { IconButton } from "./Button";
import { cx } from "./cx";
import { useToastHost } from "./Toast";

export type DialogProps = {
  /** The parent owns this: the dialog shows while it is true and never closes itself. */
  open: boolean;
  /** Called once when the person asks to leave: Escape, the close button, or a click outside. */
  onClose: () => void;
  title: string;
  /** sheet: slides up from the bottom edge on phones; a centred dialog on wider screens. */
  variant?: "dialog" | "sheet";
  /** Buttons for the bottom row. */
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Modal dialog on the native <dialog> element, which supplies the focus trap, an inert page
 * behind it and focus return to the control that opened it.
 */
export function Dialog({ open, onClose, title, variant = "dialog", actions, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressStartedOnBackdrop = useRef(false);
  const latest = useRef({ open, onClose });
  latest.current = { open, onClose };
  // Each close() we make queues one native close event; those are ours and must not reach onClose.
  const ownCloses = useRef(0);
  const closeElement = (dialog: HTMLDialogElement | null) => {
    if (!dialog?.open) return;
    ownCloses.current += 1;
    dialog.close();
  };
  const addToastHost = useToastHost();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open) closeElement(dialog);
  }, [open]);

  // Closing the element before React removes it is what sends focus back to the opener when a
  // screen renders the dialog only while it is shown.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => closeElement(dialog);
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog || !addToastHost) return;
    return addToastHost(dialog);
  }, [open, addToastHost]);

  return (
    <dialog ref={ref} className={cx("ui-dialog", variant === "sheet" && "ui-dialog--sheet")} aria-labelledby={titleId}
      // Escape asks; the parent decides by changing `open`.
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      // The browser can still close a dialog itself (a second Escape in Chromium). Tell the parent
      // so its state does not say "open" with nothing on screen.
      onClose={() => {
        if (ownCloses.current > 0) { ownCloses.current -= 1; return; }
        if (latest.current.open) latest.current.onClose();
      }}
      // The panel fills the dialog box, so a press and release that both land on the dialog element
      // are on the backdrop. Requiring both keeps a text-selection drag from closing it.
      onPointerDown={(event) => { pressStartedOnBackdrop.current = event.target === ref.current; }}
      onClick={(event) => { if (pressStartedOnBackdrop.current && event.target === ref.current) onClose(); }}>
      <div className="ui-dialog__panel">
        <div className="ui-dialog__head">
          <h2 className="ui-dialog__title" id={titleId}>{title}</h2>
          <IconButton label="Close" variant="ghost" size="sm" onClick={onClose}><X size={18} aria-hidden="true" /></IconButton>
        </div>
        <div className="ui-dialog__body">{children}</div>
        {actions ? <div className="ui-dialog__actions">{actions}</div> : null}
      </div>
    </dialog>
  );
}
