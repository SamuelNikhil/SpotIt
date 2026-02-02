import geckos from "@geckos.io/server";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import { randomBytes } from "crypto";

/**
 * SPOTIT AUTHORITATIVE SERVER - v3.5
 *
 * Features:
 * - Persistent Room & Player State.
 * - Score preservation during disconnect grace periods.
 * - Server-side 30s Game Timer.
 * - Team Leader identification and room management.
 */

const app = express();
app.use(helmet());
app.use(cors());

const server = http.createServer(app);
const io = geckos({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

io.addServer(server);

const ROOMS = new Map();
const DISCONNECT_TIMEOUTS = new Map();

const GAME_CONFIG = {
  ROUND_TIME: 30,
  POINTS_PER_HIT: 20,
};

const IMAGE_DATABASE = [
  {
    id: "test_circuit",
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=2000",
    difficulty: "low",
    hotspots: [
      {
        id: "chip",
        x: 50.0,
        y: 50.0,
        radius: 8,
        clue: "Find the main Central Processor Chip",
      },
      {
        id: "capacitor",
        x: 23.5,
        y: 18.2,
        radius: 6,
        clue: "Locate the tall Blue Capacitor",
      },
      {
        id: "resistor",
        x: 78.2,
        y: 82.5,
        radius: 7,
        clue: "Find the cluster of resistors at the bottom",
      },
      {
        id: "connector",
        x: 10.5,
        y: 45.0,
        radius: 5,
        clue: "Spot the silver connector on the left edge",
      },
      {
        id: "led",
        x: 85.0,
        y: 25.0,
        radius: 5,
        clue: "Find the Green Status LED on the right",
      },
    ],
  },
];

function generateRoomId() {
  return randomBytes(3).toString("hex").toUpperCase();
}

function generateToken() {
  return randomBytes(16).toString("hex");
}

function isHit(clickX, clickY, targetHotspot) {
  if (!targetHotspot) return false;
  const dist = Math.sqrt(
    Math.pow(clickX - targetHotspot.x, 2) +
      Math.pow(clickY - targetHotspot.y, 2),
  );
  return dist <= targetHotspot.radius;
}

/**
 * Broadcasts the current lobby state to the screen and active players.
 */
function broadcastLobbyState(room) {
  if (!room) return;
  const playersArray = Array.from(room.players.values());
  const activePlayers = playersArray.filter((p) => p.connected);

  const readyCount = activePlayers.filter((p) => p.isReady).length;
  const totalPlayers = activePlayers.length;
  const allReady = totalPlayers > 0 && activePlayers.every((p) => p.isReady);

  const state = {
    allReady,
    readyCount,
    totalPlayers,
    teamName: room.teamName || "",
    status: room.status,
  };

  if (room.screenChannel) room.screenChannel.emit("lobbyUpdate", state);
  activePlayers.forEach((p) => p.channel?.emit("lobbyUpdate", state));
}

function startGameTimer(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timeLeft = GAME_CONFIG.ROUND_TIME;

  room.timerInterval = setInterval(() => {
    room.timeLeft--;

    const timeData = { timeLeft: room.timeLeft };
    room.screenChannel?.emit("timerUpdate", timeData);
    room.players.forEach((p) => {
      if (p.connected) p.channel?.emit("timerUpdate", timeData);
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
    players: playersArray.map((p) => ({
      name: p.name,
      score: p.score,
    })),
    timeLeft: room.timeLeft,
  };

  room.screenChannel?.emit("gameOver", results);
  playersArray.forEach((p) => {
    if (p.connected) p.channel?.emit("gameOver", results);
  });
}

function resetRoomState(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  const playersArray = Array.from(room.players.values());
  const results = {
    teamName: room.teamName,
    totalScore: playersArray.reduce((acc, p) => acc + p.score, 0),
    players: playersArray.map((p) => ({
      name: p.name,
      score: p.score,
    })),
    timeLeft: room.timeLeft,
  };

  // Tell screen to show results (it will handle the 3s delay)
  room.screenChannel?.emit("roomReset", results);

  // Tell all connected players to exit
  playersArray.forEach((p) => {
    if (p.connected) p.channel?.emit("exited");
  });

  ROOMS.delete(room.id);
  DISCONNECT_TIMEOUTS.delete(room.id);
  console.log(`[Room Reset] ${room.id}`);
}

io.onConnection((channel) => {
  console.log(`[Connect] ${channel.id}`);

  channel.on("probeRoom", ({ roomId }) => {
    const room = ROOMS.get(roomId);
    if (room) {
      channel.emit("roomInfo", {
        teamName: room.teamName,
        status: room.status,
      });
    }
  });

  channel.on("createRoom", () => {
    const roomId = generateRoomId();
    const token = generateToken();
    const roomState = {
      id: roomId,
      token: token,
      screenChannel: channel,
      players: new Map(), // channelId -> player object
      teamName: null,
      currentImage: IMAGE_DATABASE[0],
      currentHotspotIndex: 0,
      status: "LOBBY",
      timeLeft: GAME_CONFIG.ROUND_TIME,
      timerInterval: null,
    };
    ROOMS.set(roomId, roomState);
    channel.userData = { role: "screen", roomId };
    channel.emit("roomCreated", {
      roomId,
      token,
      image: { url: roomState.currentImage.url },
    });
  });

  channel.on("joinRoom", ({ roomId, token, teamName }) => {
    const room = ROOMS.get(roomId);
    if (!room || room.token !== token)
      return channel.emit("joinResponse", {
        success: false,
        error: "Invalid Room",
      });

    // Cancel deletion if leader or any player is reconnecting
    if (DISCONNECT_TIMEOUTS.has(roomId)) {
      clearTimeout(DISCONNECT_TIMEOUTS.get(roomId));
      DISCONNECT_TIMEOUTS.delete(roomId);
      console.log(`[Reconnect] Grace period cancelled for ${roomId}`);
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
        ? room.teamName || teamName || "Leader"
        : `Member ${room.players.size + 1}`,
      isLeader: isLeader,
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
    });
    broadcastLobbyState(room);
  });

  channel.on("setReady", () => {
    const { roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (!room) return;
    const player = room.players.get(channel.id);
    if (player) {
      player.isReady = true;
      broadcastLobbyState(room);
    }
  });

  channel.on("startGame", () => {
    const { roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (!room) return;
    const player = room.players.get(channel.id);
    if (!player || !player.isLeader) return;

    room.status = "PLAYING";
    room.currentHotspotIndex = 0;
    room.players.forEach((p) => (p.score = 0)); // Reset all scores

    const firstClue = room.currentImage.hotspots[0].clue;
    room.screenChannel?.emit("gameStarted", { clue: firstClue });
    room.players.forEach((p) => {
      if (p.connected) p.channel?.emit("gameStarted", { clue: firstClue });
    });
    startGameTimer(room);
  });

  channel.on("cursorUpdate", (data) => {
    const { roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (!room) return;
    const player = room.players.get(channel.id);
    if (player) {
      player.cursorX = data.x;
      player.cursorY = data.y;
      room.screenChannel?.emit(
        "cursorMoved",
        { playerId: channel.id, x: data.x, y: data.y },
        { reliable: false },
      );
    }
  });

  channel.on("spotObject", () => {
    const { roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (!room || room.status !== "PLAYING") return;

    const player = room.players.get(channel.id);
    if (!player) return;

    const target = room.currentImage.hotspots[room.currentHotspotIndex];

    if (isHit(player.cursorX, player.cursorY, target)) {
      player.score += GAME_CONFIG.POINTS_PER_HIT;
      room.currentHotspotIndex++;

      const isGameOver =
        room.currentHotspotIndex >= room.currentImage.hotspots.length;
      const nextClue = isGameOver
        ? null
        : room.currentImage.hotspots[room.currentHotspotIndex].clue;

      const feedback = {
        type: "HIT",
        playerId: channel.id,
        x: player.cursorX,
        y: player.cursorY,
        newScore: player.score,
        nextClue,
        isGameOver,
      };
      room.screenChannel?.emit("spotFeedback", feedback);
      room.players.forEach((p) => {
        if (p.connected)
          p.channel?.emit("spotResult", {
            success: true,
            points: GAME_CONFIG.POINTS_PER_HIT,
            nextClue,
            isGameOver,
          });
      });

      if (isGameOver) endGame(room, "COMPLETE");
    } else {
      room.screenChannel?.emit("spotFeedback", {
        type: "MISS",
        playerId: channel.id,
        x: player.cursorX,
        y: player.cursorY,
      });
      channel.emit("spotResult", { success: false });
    }
  });

  channel.on("exitRoom", () => {
    const { role, roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (!room) return;

    const player = room.players.get(channel.id);
    if (player?.isLeader || role === "screen") {
      resetRoomState(room);
    } else {
      room.players.delete(channel.id);
      room.screenChannel?.emit("playerLeft", { id: channel.id });
      broadcastLobbyState(room);
      channel.emit("exited");
    }
  });

  channel.onDisconnect(() => {
    const { role, roomId } = channel.userData || {};
    const room = ROOMS.get(roomId);
    if (!room) return;

    const player = room.players.get(channel.id);
    if (role === "screen") {
      resetRoomState(room);
    } else if (player?.isLeader) {
      console.log(
        `[Disconnect] Leader left ${roomId}. Starting 10s grace period.`,
      );
      player.connected = false; // Keep player in map to preserve score
      room.screenChannel?.emit("playerLeft", { id: channel.id });
      broadcastLobbyState(room);

      const timeoutId = setTimeout(() => {
        if (ROOMS.has(roomId)) {
          const r = ROOMS.get(roomId);
          const currentLeader = Array.from(r.players.values()).find(
            (p) => p.isLeader,
          );
          if (currentLeader && !currentLeader.connected) {
            console.log(`[Timeout] Leader failed to return. Resetting.`);
            resetRoomState(r);
          }
        }
      }, 10000);
      DISCONNECT_TIMEOUTS.set(roomId, timeoutId);
    } else if (player) {
      room.players.delete(channel.id);
      room.screenChannel?.emit("playerLeft", { id: channel.id });
      broadcastLobbyState(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SpotIt Server running on port ${PORT}`));
