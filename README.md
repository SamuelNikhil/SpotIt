# SpotIt

SpotIt is a multiplayer "Find Objects" game where players use their smartphones as controllers to find hidden objects on a shared central screen.

## Description
The game features an authoritative server architecture using `@geckos.io` for high-performance WebRTC communication. One device (usually a desktop/TV) acts as the **Game Screen**, while multiple players join via their mobile devices to move their cursors and "spot" objects based on riddles.

## Quick Start (Local Development)

### 1. Start the Server
```bash
cd server
npm install
npm run dev
```
The server runs on `http://localhost:3000`.

### 2. Start the Client
```bash
cd client
npm install
npm run dev
```
The client runs on `http://localhost:5173`.

### 3. How to Play
1. Open `http://localhost:5173` on your computer. Select **"Host Game"** (this becomes the Screen).
2. Scan the QR code or enter the Room ID on your mobile device at the same URL.
3. Once players are ready, the Host starts the game!

---

## Deployment Instructions

### Prerequisites
- **Node.js** (v18 or higher recommended)
- A server with a public IP (or proper port forwarding)
- **SSL/HTTPS** (Required for WebRTC in most browsers)

### Step-by-Step Deployment

#### 1. Server Setup
1. Upload the `server` folder to your hosting provider.
2. Create a `.env` file in the `server` directory:
   ```env
   ALLOWED_ORIGIN=https://your-frontend-domain.com
   ```
3. Install dependencies and start:
   ```bash
   npm install --production
   npm start
   ```
   *Note: Ensure UDP ports (default range for Geckos.io/WebRTC) are open in your firewall.*

#### 2. Client Build
1. Create a `.env` file in the `client` directory:
   ```env
   VITE_SERVER_URL=https://your-backend-api.com
   VITE_SERVER_PORT=443
   ```
2. Build the project:
   ```bash
   npm install
   npm run build
   ```
3. Deploy the resulting `client/dist` folder to any static hosting service (Netlify, Vercel etc.).

#### 3. Network Configuration
- **Proxying:** If using Nginx as a reverse proxy for the server, ensure it is configured to handle WebSockets and the Geckos.io `.wrtc` signaling path.
- **STUN/TURN:** The app uses Google's public STUN server by default. For restrictive corporate networks, you may need to configure a custom TURN server in `server/index.js`.
