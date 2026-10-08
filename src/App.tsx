// Stable entry points for main.tsx, the unit tests and the browser-test harness.
// The app itself lives in src/app.
export { App } from "./app/ClerkApp";
export { OtofolksApp } from "./app/OtofolksApp";
export { isAdminModeratorEmail, priceForModel } from "./app/model";
export { buildTopPitStopReels, filterPitStopClipsByCategory } from "./pitstop";
