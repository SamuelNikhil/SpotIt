import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverUrl = env.VITE_SERVER_URL || "http://localhost";
  const serverPort = env.VITE_SERVER_PORT || "3000";

  // Construct target for proxying signaling requests (matches SlingShot-game proxy logic)
  const target = serverUrl.match(/:\d+/)
    ? serverUrl
    : `${serverUrl.replace(/\/$/, "")}:${serverPort}`;

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      allowedHosts: true,
      proxy: {
        "/.wrtc": {
          target: target,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
    preview: {
      host: true,
      allowedHosts: true,
      proxy: {
        "/.wrtc": {
          target: target,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  };
});
