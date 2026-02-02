import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import geckos from "@geckos.io/client";
import {
  MousePointer2,
  Target,
  AlertCircle,
  Zap,
  CheckCircle2,
  Play,
  X,
  Timer as TimerIcon,
} from "lucide-react";

const Controller = () => {
  const { roomId, token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("CONNECTING");
  const [error, setError] = useState(null);

  const [isLeader, setIsLeader] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState("");
  const [teamName, setTeamName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  const [lobbyInfo, setLobbyInfo] = useState({
    allReady: false,
    readyCount: 0,
    totalPlayers: 0,
  });

  const [score, setScore] = useState(0);
  const [currentClue, setCurrentClue] = useState("");
  const [lastResult, setLastResult] = useState(null);

  const channelRef = useRef(null);
  const cursorRef = useRef({ x: 50, y: 50 });
  const lastTouchRef = useRef(null);

  useEffect(() => {
    const url =
      window.location.hostname === "localhost"
        ? "http://localhost"
        : `http://${window.location.hostname}`;

    const channel = geckos({
      url,
      port: 3000,
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    channel.onConnect((error) => {
      if (error) {
        setError("Connection error. Retrying...");
        return;
      }
      channelRef.current = channel;
      setError(null);

      channel.emit("probeRoom", { roomId });

      const savedData = localStorage.getItem(`spotit_session_${roomId}`);
      if (savedData) {
        const { teamName: savedTeam } = JSON.parse(savedData);
        channel.emit("joinRoom", { roomId, token, teamName: savedTeam });
      } else {
        setStatus("JOINING");
      }
    });

    channel.onDisconnect(() => {
      setStatus("CONNECTING");
    });

    channel.on("roomInfo", ({ teamName }) => {
      if (teamName) setTeamName(teamName);
    });

    channel.on("joinResponse", ({ success, error, isLeader, teamName }) => {
      if (success) {
        setIsLeader(isLeader);
        if (teamName) {
          setTeamName(teamName);
          localStorage.setItem(
            `spotit_session_${roomId}`,
            JSON.stringify({ teamName }),
          );
        }
        setHasJoined(true);
        if (isLeader) setIsReady(true);
        setStatus("LOBBY");
      } else {
        localStorage.removeItem(`spotit_session_${roomId}`);
        setError(error || "Failed to join room");
        setStatus("JOINING");
      }
    });

    channel.on("lobbyUpdate", (data) => {
      setLobbyInfo(data);
      if (data.teamName) setTeamName(data.teamName);
      if (data.status === "LOBBY") setStatus("LOBBY");
    });

    channel.on("gameStarted", ({ clue }) => {
      setCurrentClue(clue);
      setStatus("PLAYING");
      setScore(0);
      setTimeLeft(30);
    });

    channel.on("timerUpdate", ({ timeLeft }) => {
      setTimeLeft(timeLeft);
    });

    channel.on("spotResult", ({ success, points, nextClue, isGameOver }) => {
      if (success) {
        setScore((prev) => prev + points);
        setLastResult("HIT");
        setCurrentClue(nextClue || "Challenge Complete!");
        if ("vibrate" in navigator) navigator.vibrate([50, 30, 50]);
      } else {
        setLastResult("MISS");
        if ("vibrate" in navigator) navigator.vibrate(100);
      }
      setTimeout(() => setLastResult(null), 800);
    });

    channel.on("gameOver", () => {
      setStatus("RESULTS");
    });

    channel.on("exited", () => {
      localStorage.removeItem(`spotit_session_${roomId}`);
      window.location.href = "/screen";
    });

    return () => {
      if (channelRef.current) channelRef.current.close();
    };
  }, [roomId, token]);

  const handleJoin = (e) => {
    e.preventDefault();
    const finalName = teamName || teamNameInput;
    if (!finalName.trim()) return;
    channelRef.current.emit("joinRoom", { roomId, token, teamName: finalName });
  };

  const handleReady = () => {
    setIsReady(true);
    channelRef.current.emit("setReady");
  };

  const handleStartGame = () => {
    if (lobbyInfo.allReady && isLeader) {
      channelRef.current.emit("startGame");
    }
  };

  const handleExit = () => {
    if (channelRef.current) {
      channelRef.current.emit("exitRoom");
    } else {
      localStorage.removeItem(`spotit_session_${roomId}`);
      navigate("/screen");
    }
  };

  const handleTouchMove = (e) => {
    if (status !== "PLAYING") return;
    const touch = e.touches[0];

    if (lastTouchRef.current) {
      const movementScale = 0.35;
      const dx = (touch.clientX - lastTouchRef.current.x) * movementScale;
      const dy = (touch.clientY - lastTouchRef.current.y) * movementScale;

      cursorRef.current.x = Math.max(
        0,
        Math.min(100, cursorRef.current.x + dx),
      );
      cursorRef.current.y = Math.max(
        0,
        Math.min(100, cursorRef.current.y + dy),
      );

      channelRef.current.emit(
        "cursorUpdate",
        { x: cursorRef.current.x, y: cursorRef.current.y },
        { reliable: false },
      );
    }
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
  };

  if (error && status === "CONNECTING") {
    return (
      <div className="controller-container items-center justify-center p-8 text-center">
        <AlertCircle
          size={64}
          color="var(--accent-error)"
          style={{ marginBottom: "1.5rem" }}
        />
        <h1
          className="logo-text"
          style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}
        >
          Connection Lost
        </h1>
        <p style={{ opacity: 0.6, marginBottom: "2rem" }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="spot-btn w-full"
          style={{ flex: "none", padding: "1.25rem" }}
        >
          Reconnect
        </button>
      </div>
    );
  }

  return (
    <div className="controller-container overflow-hidden">
      {/* HEADER */}
      <header
        className="screen-header"
        style={{ height: "70px", padding: "0 1.5rem" }}
      >
        <div className="flex flex-col" style={{ maxWidth: "50%" }}>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 900,
              opacity: 0.4,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {status === "PLAYING" ? (
              <div className="flex items-center gap-1">
                <TimerIcon
                  size={10}
                  className={timeLeft < 10 ? "timer-danger" : ""}
                />
                <span>{timeLeft}s Left</span>
              </div>
            ) : (
              "Team"
            )}
          </span>
          <span
            style={{
              fontSize: "0.9rem",
              fontWeight: 800,
              fontStyle: "italic",
              textTransform: "uppercase",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {teamName || "SpotIt"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {status === "PLAYING" && (
            <div style={{ textAlign: "right", marginRight: "0.5rem" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "9px",
                  fontWeight: 900,
                  opacity: 0.4,
                }}
              >
                PTS
              </span>
              <span
                style={{
                  color: "var(--accent-primary)",
                  fontWeight: 900,
                  fontFamily: "monospace",
                  fontSize: "1.25rem",
                }}
              >
                {score}
              </span>
            </div>
          )}
          <button
            onClick={handleExit}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "1px solid var(--glass-border)",
              background: "rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main
        className="flex-col h-full relative"
        style={{ display: "flex", flex: 1 }}
      >
        {/* JOINING / LOBBY / RESULTS OVERLAYS */}
        {(status === "JOINING" ||
          status === "LOBBY" ||
          status === "RESULTS") && (
          <div
            className="flex-col items-center justify-center p-6 animate-in"
            style={{ display: "flex", flex: 1 }}
          >
            <div
              className="glass-card w-full p-8 text-center"
              style={{ maxWidth: "400px" }}
            >
              {status === "JOINING" && (
                <>
                  <Zap
                    size={48}
                    color="var(--accent-primary)"
                    style={{ margin: "0 auto 1.5rem" }}
                  />
                  <h2
                    className="logo-text"
                    style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}
                  >
                    {teamName ? "JOIN TEAM" : "CREATE TEAM"}
                  </h2>
                  <form
                    onSubmit={handleJoin}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {!teamName ? (
                      <input
                        type="text"
                        placeholder="Team Name"
                        maxLength={12}
                        value={teamNameInput}
                        onChange={(e) => setTeamNameInput(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "1.25rem",
                          borderRadius: "16px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid var(--glass-border)",
                          color: "white",
                          fontSize: "1.1rem",
                          outline: "none",
                          textAlign: "center",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          padding: "1.5rem",
                          background: "rgba(255,255,255,0.03)",
                          borderRadius: "16px",
                          border: "1px solid var(--glass-border)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "1.2rem",
                            fontWeight: 900,
                            fontStyle: "italic",
                          }}
                        >
                          {teamName}
                        </p>
                      </div>
                    )}
                    <button
                      type="submit"
                      className="spot-btn"
                      style={{
                        flex: "none",
                        padding: "1rem",
                        margin: 0,
                        width: "100%",
                        fontSize: "1.2rem",
                      }}
                    >
                      {teamName ? "JOIN NOW" : "CONTINUE"}
                    </button>
                  </form>
                </>
              )}

              {(status === "LOBBY" || status === "RESULTS") && (
                <>
                  <h2
                    className="logo-text"
                    style={{ fontSize: "2rem", marginBottom: "1.5rem" }}
                  >
                    {teamName}
                  </h2>

                  {status === "RESULTS" && (
                    <div
                      style={{
                        marginBottom: "2rem",
                        padding: "1.5rem",
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: "24px",
                        border: "1px solid var(--glass-border)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 900,
                          opacity: 0.4,
                          letterSpacing: "2px",
                        }}
                      >
                        FINAL SCORE
                      </span>
                      <p
                        style={{
                          fontSize: "3.5rem",
                          fontWeight: 900,
                          color: "var(--accent-primary)",
                          fontFamily: "monospace",
                        }}
                      >
                        {score}
                      </p>
                    </div>
                  )}

                  {isLeader ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          color: "var(--accent-primary)",
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircle2 size={18} />{" "}
                        <span>You are the Leader</span>
                      </div>
                      <p style={{ fontSize: "0.8rem", opacity: 0.5 }}>
                        {lobbyInfo.readyCount}/{lobbyInfo.totalPlayers} Players
                        Ready
                      </p>
                      <button
                        onClick={handleStartGame}
                        disabled={!lobbyInfo.allReady}
                        className="spot-btn"
                        style={{
                          flex: "none",
                          padding: "1.25rem",
                          margin: 0,
                          width: "100%",
                          opacity: lobbyInfo.allReady ? 1 : 0.3,
                        }}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Play fill="currentColor" size={20} />
                          <span>
                            {status === "RESULTS" ? "RESTART" : "START GAME"}
                          </span>
                        </div>
                      </button>
                    </div>
                  ) : !isReady ? (
                    <button
                      onClick={handleReady}
                      className="spot-btn"
                      style={{
                        background: "var(--accent-secondary)",
                        flex: "none",
                        padding: "1.25rem",
                        margin: 0,
                        width: "100%",
                      }}
                    >
                      READY TO PLAY
                    </button>
                  ) : (
                    <div
                      className="flex-col items-center gap-4"
                      style={{ display: "flex" }}
                    >
                      <CheckCircle2 size={48} color="var(--accent-success)" />
                      <p
                        style={{ fontWeight: 800, textTransform: "uppercase" }}
                      >
                        You are ready
                      </p>
                      <p style={{ fontSize: "0.8rem", opacity: 0.5 }}>
                        Waiting for leader...
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* GAMEPLAY CONTROLS */}
        {status === "PLAYING" && (
          <div
            className="flex-col animate-in"
            style={{ display: "flex", flex: 1, padding: "1rem", gap: "1rem" }}
          >
            <div
              className="flex-col"
              style={{
                display: "flex",
                gap: "0.25rem",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  opacity: 0.5,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Current Target
              </span>
              <p
                style={{ fontWeight: 800, fontStyle: "italic", color: "white" }}
              >
                {currentClue}
              </p>
            </div>

            <div
              onTouchMove={handleTouchMove}
              onTouchEnd={() => {
                lastTouchRef.current = null;
              }}
              className="touchpad"
              style={{ margin: 0, position: "relative" }}
            >
              <MousePointer2 size={48} style={{ opacity: 0.1 }} />
              <p
                style={{
                  position: "absolute",
                  bottom: "2rem",
                  fontSize: "10px",
                  fontWeight: 900,
                  opacity: 0.2,
                  letterSpacing: "4px",
                  textTransform: "uppercase",
                }}
              >
                Touchpad
              </p>

              {lastResult === "HIT" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(16, 185, 129, 0.1)",
                    borderRadius: "var(--radius-lg)",
                    animation: "pulse-danger 0.5s",
                  }}
                />
              )}
              {lastResult === "MISS" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(239, 68, 68, 0.1)",
                    borderRadius: "var(--radius-lg)",
                    animation: "pulse-danger 0.5s",
                  }}
                />
              )}
            </div>

            <button
              onClick={() => {
                if (status === "PLAYING") channelRef.current.emit("spotObject");
              }}
              className="spot-btn"
              style={{
                margin: 0,
                flex: "none",
                height: "140px",
                background:
                  lastResult === "HIT"
                    ? "var(--accent-success)"
                    : lastResult === "MISS"
                      ? "var(--accent-error)"
                      : "var(--accent-primary)",
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <Target size={32} />
                <span>SPOT OBJECT</span>
              </div>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Controller;
