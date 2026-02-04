import React, { useState, useEffect, useRef } from "react";
import geckos from "@geckos.io/client";
import { QRCodeSVG } from "qrcode.react";
import {
  Users,
  Timer,
  Target,
  Trophy,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import ScoreCard from "../components/ScoreCard";
import { getServerConfig } from "../utils/network";
import { GAME_STATUS, EVENTS } from "../constants";

const Screen = () => {
  const [roomId, setRoomId] = useState(null);
  const [joinToken, setJoinToken] = useState(null);
  const [players, setPlayers] = useState([]);
  const [teamName, setTeamName] = useState("Waiting for Team...");
  const [status, setStatus] = useState(GAME_STATUS.CONNECTING); // CONNECTING, LOBBY, PLAYING, RESULTS
  const [currentImage, setCurrentImage] = useState({
    url: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2000",
  });
  const [currentClue, setCurrentClue] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [feedbacks, setFeedbacks] = useState([]);
  const [results, setResults] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [preloadedImage, setPreloadedImage] = useState(null);

  const channelRef = useRef(null);

  useEffect(() => {
    // Use the SlingShot-style dynamic network configuration
    const { geckosUrl, geckosPort, geckosPath } = getServerConfig();

    const channel = geckos({
      url: geckosUrl,
      port: geckosPort,
      ...(geckosPath && { path: geckosPath }),
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    channel.onConnect((error) => {
      if (error) return;
      channelRef.current = channel;
      
      // Try to recover room from localStorage
      const savedRoomId = localStorage.getItem("spotit_roomId");
      const savedToken = localStorage.getItem("spotit_token");

      if (savedRoomId && savedToken) {
        console.log("[Recovery] Attempting to recover room:", savedRoomId);
        channel.emit(EVENTS.RECOVER_ROOM, { roomId: savedRoomId, token: savedToken });
      } else {
        setStatus(GAME_STATUS.CONNECTED);
        channel.emit(EVENTS.CREATE_ROOM);
      }
    });

    channel.on(EVENTS.ROOM_CREATED, ({ roomId, token, recovered }) => {
      setRoomId(roomId);
      setJoinToken(token);
      localStorage.setItem("spotit_roomId", roomId);
      localStorage.setItem("spotit_token", token);
      setStatus(GAME_STATUS.LOBBY);
      setIsResetting(false);
      if (recovered) {
        console.log("[Recovery] Room recovered successfully");
      }
    });

    channel.on(EVENTS.JOIN_RESPONSE, (res) => {
      if (!res.success && res.error.includes("Room not found")) {
        console.log("[Recovery] Failed to recover room, creating new one");
        localStorage.removeItem("spotit_roomId");
        localStorage.removeItem("spotit_token");
        channel.emit(EVENTS.CREATE_ROOM);
      }
    });

    channel.on(EVENTS.ROOM_RESET, (finalResults) => {
      setResults(finalResults);
      setStatus(GAME_STATUS.RESULTS);
      setIsResetting(true);
      localStorage.removeItem("spotit_roomId");
      localStorage.removeItem("spotit_token");

      setTimeout(() => {
        setResults(null);
        setPlayers([]);
        setTeamName("Waiting for Team...");
        setStatus(GAME_STATUS.LOBBY);
        setIsResetting(false);
        if (channelRef.current) {
          channelRef.current.emit(EVENTS.CREATE_ROOM);
        }
      }, 3000);
    });

    channel.on(EVENTS.LOBBY_UPDATE, (state) => {
      if (state.teamName) setTeamName(state.teamName);
      if (state.status === GAME_STATUS.LOBBY) {
        setStatus(GAME_STATUS.LOBBY);
        setResults(null);
      }
    });

    channel.on(EVENTS.TEAM_UPDATED, ({ teamName }) => {
      setTeamName(teamName);
    });

    channel.on(EVENTS.PLAYER_JOINED, (player) => {
      setPlayers((prev) => {
        // Check if player already exists (by id or persistentId for reconnection)
        const existingIndex = prev.findIndex(p => p.id === player.id || (player.persistentId && p.persistentId === player.persistentId));
        if (existingIndex >= 0) {
          // Update existing player
          return prev.map((p, idx) => 
            idx === existingIndex ? { ...p, ...player, connected: true } : p
          );
        }
        return [
          ...prev,
          { ...player, score: 0, cursorX: 50, cursorY: 50, connected: true },
        ];
      });
    });

    channel.on(EVENTS.PLAYER_LEFT, ({ id, disconnected, removed }) => {
      setPlayers((prev) => {
        if (removed) {
          // Player fully removed after timeout
          return prev.filter((p) => p.id !== id);
        }
        // Mark as disconnected (for reconnection)
        return prev.map((p) => (p.id === id ? { ...p, connected: false } : p));
      });
    });

    channel.on(EVENTS.GAME_STARTED, ({ clue, image }) => {
      setCurrentClue(clue);
      if (image) setCurrentImage(image);
      setStatus(GAME_STATUS.PLAYING);
      setResults(null);
      setTimeLeft(30);
    });

    channel.on(EVENTS.TIMER_UPDATE, ({ timeLeft }) => {
      setTimeLeft(timeLeft);
    });

    channel.on(EVENTS.CURSOR_MOVED, ({ playerId, x, y }) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId ? { ...p, cursorX: x, cursorY: y } : p,
        ),
      );
    });

    channel.on(EVENTS.SPOT_FEEDBACK, (data) => {
      const { type, x, y, playerId, newScore, nextClue, newImage } = data;

      if (type === "HIT") {
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, score: newScore } : p)),
        );
        if (nextClue) setCurrentClue(nextClue);
        if (newImage) setCurrentImage(newImage);
      }

      const feedbackId = Math.random().toString(36).substr(2, 9);
      setFeedbacks((prev) => [...prev, { id: feedbackId, type, x, y }]);
      setTimeout(() => {
        setFeedbacks((prev) => prev.filter((f) => f.id !== feedbackId));
      }, 1000);
    });

    channel.on(EVENTS.GAME_OVER, (gameResults) => {
      setResults(gameResults);
      setStatus(GAME_STATUS.RESULTS);
    });

    channel.on(EVENTS.PRELOAD_IMAGE, ({ url }) => {
      // Create a hidden image to trigger browser caching
      const img = new Image();
      img.src = url;
      setPreloadedImage(url);
      console.log("[Preload] Caching next image:", url);
    });

    return () => {
      if (channelRef.current) channelRef.current.close();
    };
  }, []);

  const getJoinUrl = () => {
    return `${window.location.origin}/join/${roomId}/${joinToken}`;
  };

  if (status === GAME_STATUS.CONNECTING) {
    return (
      <div className="screen-container items-center justify-center text-center">
        <Target
          size={64}
          color="var(--accent-primary)"
          style={{ marginBottom: "1rem" }}
        />
        <p className="logo-text" style={{ fontSize: "1.2rem", opacity: 0.6 }}>
          Initializing SpotIt...
        </p>
      </div>
    );
  }

  const totalTeamScore = players.reduce((acc, p) => acc + (p.score || 0), 0);

  return (
    <div className="screen-container">
      <header className="screen-header">
        <div className="logo-container">
          <div className="logo-icon">
            <Target className="text-white" size={22} />
          </div>
          <h1 className="logo-text">SPOTIT</h1>
        </div>

        <div className="header-stats">
          <div
            className="flex flex-col items-end mr-4"
            style={{
              display:
                teamName === "Waiting for Team..."
                  ? "var(--mobile-hide, flex)"
                  : "flex",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: 900,
                opacity: 0.4,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
              }}
            >
              Team
            </span>
            <span
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                color: "var(--accent-primary)",
                fontStyle: "italic",
                lineHeight: 1,
              }}
            >
              {teamName}
            </span>
          </div>

          <div className="stat-badge">
            <Users size={18} color="var(--accent-secondary)" />
            <span>{players.filter((p) => p.connected).length} Players</span>
          </div>

          {status === GAME_STATUS.PLAYING && (
            <div
              className={`stat-badge ${timeLeft < 10 ? "timer-danger" : ""}`}
            >
              <Timer size={18} />
              <span style={{ fontFamily: "monospace", fontSize: "1.1rem" }}>
                {timeLeft}s
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="game-main">
        <div className="canvas-area">
          {status === GAME_STATUS.PLAYING ? (
            <div className="relative w-full h-full">              {preloadedImage && (
                <img
                  src={preloadedImage}
                  style={{ display: "none" }}
                  alt="preload-cache"
                />
              )}              <div
                className="absolute w-full h-full"
                style={{
                  backgroundImage: `url(${currentImage.url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  transition: "all 1s ease",
                }}
              >
                <div
                  className="absolute w-full h-full"
                  style={{ background: "rgba(0,0,0,0.15)" }}
                />
              </div>

              {feedbacks.map((f) => (
                <div
                  key={f.id}
                  className="ping-feedback"
                  style={{
                    left: `${f.x}%`,
                    top: `${f.y}%`,
                    borderColor:
                      f.type === "HIT"
                        ? "var(--accent-success)"
                        : "var(--accent-error)",
                  }}
                />
              ))}

              {players.map((p, i) => (
                <div
                  key={p.id}
                  className="absolute"
                  style={{
                    left: `${p.cursorX}%`,
                    top: `${p.cursorY}%`,
                    transition: "all 0.08s ease-out",
                    zIndex: 50,
                    pointerEvents: "none",
                    display: p.connected ? "block" : "none",
                  }}
                >
                  <div
                    className="relative"
                    style={{ transform: "translate(-50%, -50%)" }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        border: "3px dashed",
                        borderRadius: "50%",
                        borderColor:
                          i === 0
                            ? "var(--accent-primary)"
                            : i === 1
                              ? "var(--accent-secondary)"
                              : "var(--accent-tertiary)",
                        animation: "expressiveFloat 4s infinite linear",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "6px",
                        height: "6px",
                        background: "white",
                        borderRadius: "50%",
                        boxShadow: "0 0 8px rgba(255,255,255,0.8)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (status === GAME_STATUS.LOBBY || status === GAME_STATUS.CONNECTED) && !isResetting ? (
            <div className="lobby-content">
              <div className="qr-wrapper">
                {roomId && (
                  <QRCodeSVG value={getJoinUrl()} size={220} level={"M"} />
                )}
              </div>
              <h2 className="lobby-title">SCAN TO JOIN</h2>
              <p className="lobby-subtitle">
                Team Leader sets name & starts game
              </p>
            </div>
          ) : (
            <div className="scorecard-overlay">
              <ScoreCard
                teamName={results?.teamName}
                score={results?.totalScore}
                players={results?.players || []}
                isLeader={players.find((p) => p.isLeader)?.connected}
                timeLeft={results?.timeLeft ?? timeLeft}
                onRestart={() => channelRef.current?.emit(EVENTS.START_GAME)}
                onExit={() => channelRef.current?.emit(EVENTS.EXIT_ROOM)}
              />
            </div>
          )}
        </div>

        <aside className="sidebar">
          {status === GAME_STATUS.PLAYING ? (
            <div
              className="glass-card flex-col h-full"
              style={{ display: "flex", flex: 1, padding: "1.5rem" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle color="var(--accent-primary)" size={24} />
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 900,
                    fontStyle: "italic",
                  }}
                >
                  THE CLUE
                </h3>
              </div>

              <div className="clue-box">
                <Sparkles
                  style={{ opacity: 0.2, marginBottom: "1rem" }}
                  size={40}
                  color="var(--accent-primary)"
                />
                <p
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 900,
                    fontStyle: "italic",
                    lineHeight: 1.2,
                  }}
                >
                  "{currentClue}"
                </p>
              </div>

              <div className="progress-container">
                <div className="flex justify-between items-center mb-2 text-white/40">
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 900,
                      opacity: 0.5,
                      letterSpacing: "1px",
                    }}
                  >
                    PROGRESS
                  </span>
                  <span
                    style={{
                      color: "var(--accent-primary)",
                      fontWeight: 900,
                      fontSize: "0.9rem",
                    }}
                  >
                    {totalTeamScore} Pts
                  </span>
                </div>
                <div
                  style={{
                    height: "10px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "99px",
                    border: "1px solid var(--glass-border)",
                    padding: "2px",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "var(--accent-primary)",
                      borderRadius: "99px",
                      transition: "width 0.5s ease",
                      width: `${Math.min(100, (totalTeamScore / 1000) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card leaderboard-container">
              <div className="flex items-center gap-2 mb-6">
                <Trophy color="#facc15" size={24} />
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 900,
                    fontStyle: "italic",
                  }}
                >
                  LEADERBOARD
                </h3>
              </div>
              <div className="leaderboard-list no-scrollbar">
                {players.length > 0 ? (
                  players
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((p, i) => (
                      <div key={p.id} className="leaderboard-item">
                        <div className="flex items-center gap-3">
                          <span
                            style={{
                              opacity: 0.3,
                              fontWeight: 900,
                              fontStyle: "italic",
                            }}
                          >
                            #0{i + 1}
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              maxWidth: "100px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.name}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span
                            style={{
                              color: "var(--accent-primary)",
                              fontWeight: 900,
                              fontFamily: "monospace",
                              fontSize: "1.1rem",
                            }}
                          >
                            {p.score || 0}
                          </span>
                          {p.isReady && p.connected && (
                            <span
                              style={{
                                fontSize: "8px",
                                color: "var(--accent-success)",
                                fontWeight: 900,
                              }}
                            >
                              READY
                            </span>
                          )}
                          {!p.connected && (
                            <span
                              style={{
                                fontSize: "8px",
                                color: "var(--accent-error)",
                                fontWeight: 900,
                              }}
                            >
                              AWAY
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                ) : (
                  <div
                    className="flex-col items-center justify-center text-center opacity-20"
                    style={{
                      display:
                        teamName === "Waiting for Team..."
                          ? "var(--mobile-hide, flex)"
                          : "flex",
                      flex: 1,
                      padding: "2rem 0",
                    }}
                  >
                    <Users size={40} style={{ marginBottom: "0.5rem" }} />
                    <p
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        letterSpacing: "1px",
                      }}
                    >
                      WAITING FOR TEAM...
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
};

export default Screen;
