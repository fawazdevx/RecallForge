import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths so the built bundle works when served from a Walrus
  // Site (content-addressed path) as well as from a normal host root.
  base: "./",
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the backend during development.
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
