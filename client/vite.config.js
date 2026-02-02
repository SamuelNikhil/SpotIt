import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverUrl = env.VITE_SERVER_URL || "http://localhost";
  const serverPort = env.VITE_SERVER_PORT || "3000";

  // Ensure protocol is present for the proxy target
  const formattedUrl = serverUrl.startsWith("http")
    ? serverUrl
    : `http://${serverUrl}`;

  // Construct target for proxying signaling requests
  const target = formattedUrl.match(/:\d+/)
    ? formattedUrl
    : `${formattedUrl.replace(/\/$/, "")}:${serverPort}`;

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
