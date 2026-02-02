/**
 * Network Configuration Utility for SpotIt
 *
 * Logic matches SlingShot-game architecture:
 * 1. DIRECT: Connects straight to EC2 (Fastest, requires HTTP-to-HTTP or HTTPS-to-HTTPS)
 * 2. PROXY: Connects via the client's own origin (Solves Mixed Content HTTPS -> HTTP issues)
 */

export function getServerConfig() {
    const useProxy = import.meta.env.VITE_USE_PROXY === 'true';
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost';
    const serverPort = parseInt(import.meta.env.VITE_SERVER_PORT) || 3000;

    let geckosUrl, geckosPort, geckosPath;

    if (useProxy) {
        // PROXY MODE: Connect through the hosting platform's proxy (Hostinger/Render/etc)
        // The client talks to its own URL, and the server-side proxy forwards to EC2
        geckosUrl = window.location.origin;
        geckosPort = window.location.protocol === 'https:' ? 443 : 80;
        geckosPath = '/.wrtc';
    } else {
        // DIRECT MODE: Connect directly to the game server (EC2 IP)
        // Best for low latency if protocols match
        const urlWithProtocol = serverUrl.startsWith('http') ? serverUrl : `http://${serverUrl}`;
        const urlObj = new URL(urlWithProtocol);

        geckosUrl = `${urlObj.protocol}//${urlObj.hostname}`;
        geckosPort = serverPort;
        geckosPath = '';
    }

    console.log('[SpotIt Network]', {
        mode: useProxy ? 'PROXY' : 'DIRECT',
        url: geckosUrl,
        port: geckosPort,
        path: geckosPath
    });

    return {
        geckosUrl,
        geckosPort,
        geckosPath,
        useProxy
    };
}
