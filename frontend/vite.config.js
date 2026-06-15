import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In sviluppo: proxy /api verso il backend (porta host 8008).
// In produzione (Docker): nginx serve i file e fa da proxy /api -> backend:8000.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": { target: "http://localhost:8008", changeOrigin: true },
    },
  },
  build: { outDir: "dist" },
});
