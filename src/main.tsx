import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import { App } from "./app/App";
import "./styles.css";

/**
 * `scripts/build-service-worker.mjs` emits `dist/sw.js` with a precache manifest
 * and a navigate-request fallback to the cached shell, but nothing was calling
 * `register()`, so the offline shell never installed and the install prompt never
 * became eligible. Registration runs after load so it never competes with first
 * paint, and only in a production build (the dev server has no `/sw.js`).
 */
const registerServiceWorker = (): void => {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    // A failed registration is never fatal: the app is local-first and works without it.
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
};

registerServiceWorker();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
