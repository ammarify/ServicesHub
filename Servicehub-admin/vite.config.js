import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Without VITE_API_URL the app calls /api on its own origin (the Vercel setup),
// so the dev server forwards those paths to a local API the same way.
const LOCAL_API = "http://localhost:5000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": LOCAL_API,
      "/socket.io": LOCAL_API,
    },
  },
});
