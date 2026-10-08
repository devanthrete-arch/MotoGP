import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [react()],
  build: {
    // The 954 kB uncompressed 3D renderer is an explicit, separate on-demand import.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 8080,
  },
});
