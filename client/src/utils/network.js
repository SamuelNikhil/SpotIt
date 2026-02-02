/**
 * Network Configuration Utility for SpotIt
 *
 * Logic matches SlingShot-game architecture:
 * 1. DIRECT: Connects straight to the game server (Fastest, requires protocol matching)
 * 2. PROXY: Connects via the client's own origin (Solves Mixed Content HTTPS -> HTTP issues)
 *
 * Environment Variables:
 * - VITE_SERVER_URL: The backend server URL
 * - VITE_SERVER_PORT: The backend server port (default: 3000)
 * - VITE_USE_PROXY: 'true' to route signaling through the hosting proxy
 * - VITE_SIGNALING_PATH: Custom path for WebRTC signaling (default: '/.wrtc' for proxy)
 */

const DEFAULT_SIGNALING_PATH = "/.wrtc";

export function getServerConfig() {
  const useProxy = import.meta.env.VITE_USE_PROXY === "true";
  const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost";
  const serverPort = parseInt(import.meta.env.VITE_SERVER_PORT) || 3000;
  const customPath = import.meta.env.VITE_SIGNALING_PATH;

  let geckosUrl, geckosPort, geckosPath;

  if (useProxy) {
    // PROXY MODE: Connect through the hosting platform's proxy (Hostinger/Render/etc)
    // The client talks to its own URL, and the server-side proxy forwards to the backend
    geckosUrl = window.location.origin;
    geckosPort = window.location.protocol === "https:" ? 443 : 80;
    geckosPath = customPath || DEFAULT_SIGNALING_PATH;
  } else {
    // DIRECT MODE: Connect directly to the game server
    // Best for low latency if protocols match (HTTP to HTTP)
    const urlWithProtocol = serverUrl.startsWith("http")
      ? serverUrl
      : `http://${serverUrl}`;
    const urlObj = new URL(urlWithProtocol);

    geckosUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    geckosPort = serverPort;
    geckosPath = customPath || "";
  }

  console.log("[SpotIt Network]", {
    mode: useProxy ? "PROXY" : "DIRECT",
    url: geckosUrl,
    port: geckosPort,
    path: geckosPath,
    serverUrl,
  });

  return {
    geckosUrl,
    geckosPort,
    geckosPath,
    useProxy,
  };
}
