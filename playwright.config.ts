import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  use: {
    baseURL: "http://localhost:8081",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 8081 --strictPort",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
  },
});
