/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
  plugins: [react()],
  server: {
    port: 8080,
  },
  test: {
    // Most suites are pure logic and run fastest with no DOM. Component render
    // tests opt in per file with `@vitest-environment happy-dom`.
    environment: "node",
  },
});
