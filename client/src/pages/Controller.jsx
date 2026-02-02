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
import { getServerConfig } from "../utils/network";

/**
 * SPOTIT CONTROLLER COMPONENT
 */
const Controller = () => {
  const { roomId, token } = useParams();
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
    const { geckosUrl, geckosPort, geckosPath } = getServerConfig();

    const channel = geckos({
      url: geckosUrl,
      port: geckosPort,
      ...(geckosPath ? { path: geckosPath } : {}),
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    channel.onConnect((err) => {
      if (err) {
        setError("Connection error. Retrying...");
        return;
      }
      channelRef.current = channel;
      setError(null);
      channel.emit("probeRoom", { roomId });

      const sessionKey = "spotit_session_" + roomId;
      const savedData = localStorage.getItem(sessionKey);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          channel.emit("joinRoom", {
            roomId,
            token,
            teamName: parsed.teamName,
          });
        } catch (e) {
          setStatus("JOINING");
        }
      } else {
        setStatus("JOINING");
      }
    });

    channel.onDisconnect(() => {
      setStatus("CONNECTING");
    });

    channel.on("roomInfo", (data) => {
      if (data && data.teamName) setTeamName(data.teamName);
    });

    channel.on("joinResponse", (res) => {
      if (res.success) {
        setIsLeader(!!res.isLeader);
        if (res.teamName) {
          setTeamName(res.teamName);
          const sessionKey = "spotit_session_" + roomId;
          localStorage.setItem(
            sessionKey,
            JSON.stringify({ teamName: res.teamName }),
          );
        }
        setHasJoined(true);
        if (res.isLeader) setIsReady(true);
        setStatus("LOBBY");
      } else {
        const sessionKey = "spotit_session_" + roomId;
        localStorage.removeItem(sessionKey);
        setError(res.error || "Failed to join room");
        setStatus("JOINING");
      }
    });

    channel.on("lobbyUpdate", (data) => {
      setLobbyInfo(data);
      if (data.teamName) setTeamName(data.teamName);
      if (data.status === "LOBBY") setStatus("LOBBY");
    });

    channel.on("gameStarted", (data) => {
      setCurrentClue(data.clue || "");
      setStatus("PLAYING");
      setScore(0);
      setTimeLeft(30);
    });

    channel.on("timerUpdate", (data) => {
      setTimeLeft(data.timeLeft);
    });

    channel.on("spotResult", (res) => {
      if (res.success) {
        setScore((prev) => prev + (res.points || 0));
        setLastResult("HIT");
        if (res.nextClue) setCurrentClue(res.nextClue);
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
      const sessionKey = "spotit_session_" + roomId;
      localStorage.removeItem(sessionKey);
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
    if (channelRef.current) {
      channelRef.current.emit("joinRoom", {
        roomId,
        token,
        teamName: finalName,
      });
    }
  };

  const handleReady = () => {
    setIsReady(true);
    if (channelRef.current) {
      channelRef.current.emit("setReady");
    }
  };

  const handleStartGame = () => {
    if (isLeader && channelRef.current) {
      channelRef.current.emit("startGame");
    }
  };

  const handleExit = () => {
    if (channelRef.current) {
      channelRef.current.emit("exitRoom");
    } else {
      const sessionKey = "spotit_session_" + roomId;
      localStorage.removeItem(sessionKey);
      window.location.href = "/screen";
    }
  };

  const handleTouchMove = (e) => {
    if (status !== "PLAYING") return;
    const touch = e.touches[0];
    if (lastTouchRef.current && channelRef.current) {
      const scale = 0.35;
      const dx = (touch.clientX - lastTouchRef.current.x) * scale;
      const dy = (touch.clientY - lastTouchRef.current.y) * scale;
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
          Error
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

      <main style={{ display: "flex", flex: 1 }} className="flex-col relative">
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
                        autoFocus
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
                        <CheckCircle2 size={18} /> <span>You are Leader</span>
                      </div>
                      <p style={{ fontSize: "0.8rem", opacity: 0.5 }}>
                        {lobbyInfo.readyCount}/{lobbyInfo.totalPlayers} Ready
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
                        <Play fill="currentColor" size={20} />{" "}
                        {status === "RESULTS" ? "RESTART" : "START"}
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
                      READY
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
                        Ready
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

        {status === "PLAYING" && (
          <div
            className="flex-col animate-in"
            style={{ display: "flex", flex: 1, padding: "1rem", gap: "1rem" }}
          >
            <div
              className="flex-col"
              style={{ display: "flex", gap: "0.25rem" }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  opacity: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Riddle
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
              style={{ margin: 0, position: "relative", flex: 1 }}
            >
              <MousePointer2 size={48} style={{ opacity: 0.1 }} />
              {lastResult === "HIT" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(16, 185, 129, 0.1)",
                    borderRadius: "var(--radius-lg)",
                    animation: "ping 0.5s",
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
                    animation: "ping 0.5s",
                  }}
                />
              )}
            </div>
            <button
              onClick={() => {
                if (status === "PLAYING" && channelRef.current)
                  channelRef.current.emit("spotObject");
              }}
              className="spot-btn"
              style={{
                margin: 0,
                flex: "none",
                height: "120px",
                background:
                  lastResult === "HIT"
                    ? "var(--accent-success)"
                    : lastResult === "MISS"
                      ? "var(--accent-error)"
                      : "var(--accent-primary)",
              }}
            >
              <Target size={32} />
              <span style={{ display: "block", marginTop: "4px" }}>SPOT</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Controller;
