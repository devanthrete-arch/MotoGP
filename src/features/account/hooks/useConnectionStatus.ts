import { useEffect, useMemo, useState } from "react";
import { buildConnectionStatusCopy } from "../domain/connection";

const getInitialOnlineStatus = (): boolean => {
  try {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  } catch {
    return true;
  }
};

/**
 * Owns the browser's online/offline signal and the copy that explains what
 * still works without a connection. Self-contained: it reads no other state,
 * which is why it is the one piece of the old god-context that could move out
 * whole.
 */
export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus);

  useEffect(() => {
    const updateOnline = () => setIsOnline(true);
    const updateOffline = () => setIsOnline(false);

    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOffline);

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOffline);
    };
  }, []);

  const connectionStatus = useMemo(() => buildConnectionStatusCopy(isOnline), [isOnline]);

  return { connectionStatus, isOnline };
}
