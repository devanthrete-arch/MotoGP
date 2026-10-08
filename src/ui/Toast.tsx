import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** How long a message stays up: longer text gets longer, within 4-10 seconds. */
export const toastDuration = (text: string): number => Math.min(10000, 4000 + text.length * 60);

export type ShowToast = (text: string) => void;

type ToastApi = {
  show: ShowToast;
  /** An open modal dialog hosts the toast, since everything outside it is inert and dimmed. */
  addHost: (host: HTMLElement) => () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/**
 * One transient status message at a time. The live region stays mounted so every message is a
 * change inside it, which is what screen readers announce reliably; only the visible pill remounts.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [hosts, setHosts] = useState<HTMLElement[]>([]);

  const show = useCallback<ShowToast>((text) => {
    setToast((current) => (text ? { id: (current?.id ?? 0) + 1, text } : null));
  }, []);
  const addHost = useCallback((host: HTMLElement) => {
    setHosts((current) => [...current, host]);
    return () => setHosts((current) => current.filter((item) => item !== host));
  }, []);
  const api = useMemo(() => ({ show, addHost }), [show, addHost]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toastDuration(toast.text));
    return () => window.clearTimeout(timer);
  }, [toast]);

  const region = (
    <div className="ui-toast-region" role="status">
      {toast ? <div className="ui-toast" key={toast.id}>{toast.text}</div> : null}
    </div>
  );
  const host = hosts[hosts.length - 1];

  return (
    <ToastContext.Provider value={api}>
      {children}
      {host ? createPortal(region, host) : region}
    </ToastContext.Provider>
  );
}

/** Returns a function that shows a message; pass an empty string to clear it. */
export function useToast(): ShowToast {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside a ToastProvider");
  return api.show;
}

/** For Dialog: lets an open dialog host the toast. A no-op outside a ToastProvider. */
export function useToastHost(): ToastApi["addHost"] | null {
  return useContext(ToastContext)?.addHost ?? null;
}
