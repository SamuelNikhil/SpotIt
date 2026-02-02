import "dotenv/config";
import geckos from "@geckos.io/server";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import { randomBytes } from "crypto";

/**
 * SPOTIT AUTHORITATIVE SERVER - v4.3
 *
 * Fixes:
 * - Larger hit radii for easier spotting.
 * - Robust image loading on restart.
 * - Fixed broken Unsplash URLs.
 */

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
  }),
);

const server = http.createServer(app);
const io = geckos({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  cors: { origin: process.env.ALLOWED_ORIGIN || "*" },
});

io.addServer(server);

const ROOMS = new Map();
const DISCONNECT_TIMEOUTS = new Map();

const GAME_CONFIG = {
  LEVEL_TIME: 30,
  POINTS_PER_HIT: 20,
  MAX_RIDDLES: 8,
};

// --- IMAGE & RIDDLE DATABASE ---
const IMAGE_DATABASE = [
  {
    id: "easy_office",
    url: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2000",
    hotspots: [
      {
        id: "monitor",
        x: 50,
        y: 35,
        radius: 18, // Increased
        clue: "I am the big Screen on the desk. I show you the pictures.",
      },
      {
        id: "keyboard",
        x: 50,
        y: 75,
        radius: 15, // Increased
        clue: "I am full of letters and keys. Use me to type.",
      },
      {
        id: "mouse",
        x: 72,
        y: 80,
        radius: 12, // Increased
        clue: "I sit next to the keys. Click me to move the pointer.",
      },
      {
        id: "coffee",
        x: 75,
        y: 65,
        radius: 10, // Increased
        clue: "I am a white mug filled with a hot morning drink.",
      },
      {
        id: "lamp",
        x: 15,
        y: 30,
        radius: 12, // Increased
        clue: "I am the light on the left side of the desk.",
      },
    ],
  },
  {
    id: "luxury_kitchen",
    url: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=2000",
    hotspots: [
      {
        id: "stove",
        x: 32,
        y: 65,
        radius: 18,
        clue: "I am the master of fire. I turn raw ingredients into a feast.",
      },
      {
        id: "kettle",
        x: 18,
        y: 52,
        radius: 12,
        clue: "I scream when I'm ready for tea. I dance with the steam.",
      },
      {
        id: "fridge",
        x: 85,
        y: 40,
        radius: 20,
        clue: "I am the winter in a box. I keep your secret snacks cold.",
      },
      {
        id: "sink",
        x: 55,
        y: 68,
        radius: 15,
        clue: "I swallow water and wash your dirty dishes.",
      },
      {
        id: "clock",
        x: 50,
        y: 12,
        radius: 10,
        clue: "I have hands but no body. I tell you when the feast is ready.",
      },
    ],
  },
];

// --- HELPERS ---
function generateRoomId() {
  return randomBytes(3).toString("hex").toUpperCase();
}
function generateToken() {
  return randomBytes(16).toString("hex");
}
function isHit(x, y, target) {
  if (!target) return false;
  const dist = Math.sqrt(Math.pow(x - target.x, 2) + Math.pow(y - target.y, 2));
  return dist <= target.radius;
}

function broadcastLobbyState(room) {
  if (!room) return;
  const playersArray = Array.from(room.players.values());
  const activePlayers = playersArray.filter((p) => p.connected);
  const state = {
    allReady: activePlayers.length > 0 && activePlayers.every((p) => p.isReady),
    readyCount: activePlayers.filter((p) => p.isReady).length,
    totalPlayers: activePlayers.length,
    teamName: room.teamName || "",
    status: room.status,
  };
  if (room.screenChannel) room.screenChannel.emit("lobbyUpdate", state);
  activePlayers.forEach((p) => p.channel?.emit("lobbyUpdate", state));
}

function selectLevelData(room) {
  const teamScore = Array.from(room.players.values()).reduce(
    (acc, p) => acc + p.score,
    0,
  );

  // Difficulty Logic
  let riddleCount = 3;
  if (teamScore >= 200) riddleCount = 5;
  else if (teamScore >= 100) riddleCount = 4;
  riddleCount = Math.min(GAME_CONFIG.MAX_RIDDLES, riddleCount);

  // Pick image
  let nextImage;
  if (!room.currentImage) {
    nextImage = IMAGE_DATABASE[0];
  } else {
    // Pick a different one if possible
    const otherImages = IMAGE_DATABASE.filter(
      (img) => img.id !== room.currentImage.id,
    );
    nextImage =
      otherImages.length > 0
        ? otherImages[Math.floor(Math.random() * otherImages.length)]
        : IMAGE_DATABASE[0];
  }

  room.currentImage = nextImage;
  const shuffled = [...nextImage.hotspots].sort(() => 0.5 - Math.random());
  room.currentHotspots = shuffled.slice(0, riddleCount);
  room.currentHotspotIndex = 0;
  console.log(
    `[LEVEL] Room ${room.id} -> Image: ${nextImage.id} | Riddles: ${riddleCount}`,
  );
}

function startGameTimer(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timeLeft = GAME_CONFIG.LEVEL_TIME;

  room.timerInterval = setInterval(() => {
    room.timeLeft--;
    const timeData = { timeLeft: room.timeLeft };
    room.screenChannel?.emit("timerUpdate", timeData);
    room.players.forEach((p) => {
      if (p.connected) p.channel.emit("timerUpdate", timeData);
    });

    if (room.timeLeft <= 0) {
      clearInterval(room.timerInterval);
      endGame(room, "TIME_UP");
    }
  }, 1000);
}

function endGame(room, reason) {
  room.status = "RESULTS";
  if (room.timerInterval) clearInterval(room.timerInterval);
  const playersArray = Array.from(room.players.values());
  const results = {
    reason,
    teamName: room.teamName,
    totalScore: playersArray.reduce((acc, p) => acc + p.score, 0),
    players: playersArray.map((p) => ({ name: p.name, score: p.score })),
    timeLeft: 0,
  };
  room.screenChannel?.emit("gameOver", results);
  playersArray.forEach((p) => {
    if (p.connected) p.channel.emit("gameOver", results);
  });
}

function resetRoomState(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  const playersArray = Array.from(room.players.values());
  const results = {
    teamName: room.teamName,
    totalScore: playersArray.reduce((acc, p) => acc + p.score, 0),
    players: playersArray.map((p) => ({ name: p.name, score: p.score })),
    timeLeft: room.timeLeft,
  };
  room.screenChannel?.emit("roomReset", results);
  playersArray.forEach((p) => {
    if (p.connected) p.channel.emit("exited");
  });
  ROOMS.delete(room.id);
  DISCONNECT_TIMEOUTS.delete(room.id);
  console.log(`[Room Reset] ${room.id}`);
}

// --- SOCKET CONNECTION ---
io.onConnection((channel) => {
  console.log(`[Connect] ${channel.id}`);

  channel.on("probeRoom", ({ roomId }) => {
    const room = ROOMS.get(roomId);
    if (room)
      channel.emit("roomInfo", {
        teamName: room.teamName,
        status: room.status,
      });
  });

  channel.on("createRoom", () => {
    const roomId = generateRoomId();
    const token = generateToken();
    const roomState = {
      id: roomId,
      token: token,
      screenChannel: channel,
      players: new Map(),
      teamName: null,
      currentImage: null,
      currentHotspots: [],
      currentHotspotIndex: 0,
      status: "LOBBY",
      timeLeft: GAME_CONFIG.LEVEL_TIME,
      timerInterval: null,
    };
    ROOMS.set(roomId, roomState);
    channel.userData = { role: "screen", roomId };
    channel.emit("roomCreated", { roomId, token });
    console.log(`[Created] ${roomId}`);
  });

  channel.on("joinRoom", ({ roomId, token, teamName }) => {
    const room = ROOMS.get(roomId);
    if (!room || room.token !== token)
      return channel.emit("joinResponse", {
        success: false,
        error: "Invalid Room",
      });

    if (DISCONNECT_TIMEOUTS.has(roomId)) {
      clearTimeout(DISCONNECT_TIMEOUTS.get(roomId));
      DISCONNECT_TIMEOUTS.delete(roomId);
    }

    const isLeader = room.players.size === 0;
    if (isLeader && teamName) {
      room.teamName = teamName;
      room.screenChannel?.emit("teamUpdated", { teamName });
    }

    const playerObj = {
      id: channel.id,
      channel: channel,
      name: isLeader
        ? room.teamName || teamName
        : `Member ${room.players.size + 1}`,
      isLeader,
      isReady: isLeader,
      connected: true,
      score: 0,
      cursorX: 50,
      cursorY: 50,
    };

    room.players.set(channel.id, playerObj);
    channel.userData = { role: "controller", roomId };
    channel.emit("joinResponse", {
      success: true,
      isLeader,
      teamName: room.teamName,
    });
    room.screenChannel?.emit("playerJoined", {
      id: playerObj.id,
      name: playerObj.name,
      isLeader,
      connected: true,
    });
    broadcastLobbyState(room);
  });

  channel.on("setReady", () => {
    const { roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (room) {
      const p = room.players.get(channel.id);
      if (p) {
        p.isReady = true;
        broadcastLobbyState(room);
      }
    }
  });

  channel.on("startGame", () => {
    const { roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (!room) return;
    const player = room.players.get(channel.id);
    if (!player || !player.isLeader) return;

    console.log(`[Start] Game starting in room ${roomId}`);
    room.status = "PLAYING";
    room.players.forEach((p) => (p.score = 0));

    // Always pick fresh level data on start/restart
    selectLevelData(room);

    const firstClue = room.currentHotspots[0].clue;
    const imgData = { url: room.currentImage.url };

    room.screenChannel?.emit("gameStarted", {
      clue: firstClue,
      image: imgData,
    });
    room.players.forEach((p) => {
      if (p.connected)
        p.channel.emit("gameStarted", { clue: firstClue, image: imgData });
    });
    startGameTimer(room);
  });

  channel.on("cursorUpdate", (data) => {
    const { roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (room) {
      const p = room.players.get(channel.id);
      if (p) {
        p.cursorX = data.x;
        p.cursorY = data.y;
        room.screenChannel?.emit(
          "cursorMoved",
          { playerId: channel.id, x: data.x, y: data.y },
          { reliable: false },
        );
      }
    }
  });

  channel.on("spotObject", () => {
    const { roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (!room || room.status !== "PLAYING") return;
    const p = room.players.get(channel.id);
    if (!p) return;

    const target = room.currentHotspots[room.currentHotspotIndex];
    if (isHit(p.cursorX, p.cursorY, target)) {
      p.score += GAME_CONFIG.POINTS_PER_HIT;
      room.currentHotspotIndex++;
      const isLevelOver =
        room.currentHotspotIndex >= room.currentHotspots.length;

      if (isLevelOver) {
        selectLevelData(room);
        const nextClue = room.currentHotspots[0].clue;
        const feedback = {
          type: "HIT",
          playerId: channel.id,
          x: p.cursorX,
          y: p.cursorY,
          newScore: p.score,
          nextClue,
          newImage: { url: room.currentImage.url },
        };
        room.screenChannel?.emit("spotFeedback", feedback);
        room.players.forEach((plr) => {
          if (plr.connected) plr.channel.emit("spotResult", feedback);
        });
        startGameTimer(room);
      } else {
        const nextClue = room.currentHotspots[room.currentHotspotIndex].clue;
        const feedback = {
          type: "HIT",
          playerId: channel.id,
          x: p.cursorX,
          y: p.cursorY,
          newScore: p.score,
          nextClue,
        };
        room.screenChannel?.emit("spotFeedback", feedback);
        room.players.forEach((plr) => {
          if (plr.connected) plr.channel.emit("spotResult", feedback);
        });
      }
    } else {
      room.screenChannel?.emit("spotFeedback", {
        type: "MISS",
        playerId: channel.id,
        x: p.cursorX,
        y: p.cursorY,
      });
      channel.emit("spotResult", { success: false });
    }
  });

  channel.on("exitRoom", () => {
    const { role, roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (room) {
      const p = room.players.get(channel.id);
      if (p?.isLeader || role === "screen") resetRoomState(room);
      else {
        room.players.delete(channel.id);
        room.screenChannel?.emit("playerLeft", { id: channel.id });
        broadcastLobbyState(room);
        channel.emit("exited");
      }
    }
  });

  channel.onDisconnect(() => {
    const { role, roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (!room) return;
    const p = room.players.get(channel.id);
    if (role === "screen") resetRoomState(room);
    else if (p?.isLeader) {
      p.connected = false;
      room.screenChannel?.emit("playerLeft", { id: channel.id });
      broadcastLobbyState(room);
      const timeoutId = setTimeout(() => {
        const r = ROOMS.get(roomId);
        if (r) {
          const leader = Array.from(r.players.values()).find((l) => l.isLeader);
          if (leader && !leader.connected) resetRoomState(r);
        }
      }, 10000);
      DISCONNECT_TIMEOUTS.set(roomId, timeoutId);
    } else if (p) {
      room.players.delete(channel.id);
      room.screenChannel?.emit("playerLeft", { id: channel.id });
      broadcastLobbyState(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`SpotIt v4.3 Server running on port ${PORT}`),
);
