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
  const [status, setStatus] = useState("CONNECTING"); // CONNECTING, JOINING, LOBBY, PLAYING, RESULTS
  const [error, setError] = useState(null);

  // Persistence & Logic states
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
        setError("Connection lost. Reconnecting...");
        return;
      }
      channelRef.current = channel;
      setError(null);

      // Probe room state for existing data
      channel.emit("probeRoom", { roomId });

      // Check for reconnection data in localStorage
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

    channel.on("roomInfo", ({ teamName, status: roomStatus }) => {
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
        setError(error || "Failed to join");
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
      navigate("/screen");
    });

    return () => {
      if (channelRef.current) channelRef.current.close();
    };
  }, [roomId, token, navigate]);

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
      const movementScale = 0.3;
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
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6 text-center text-white">
        <AlertCircle className="text-accent mb-4" size={48} />
        <h1 className="text-2xl font-bold mb-2">Connection Error</h1>
        <p className="opacity-60 mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary px-8 py-3 rounded-xl font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-dark touch-none select-none flex flex-col overflow-hidden font-sans">
      {/* PERSISTENT HEADER WITH EXIT */}
      <div className="h-20 flex items-center justify-between px-6 bg-white/5 border-b border-white/10 z-30">
        <div className="flex flex-col max-w-[40%]">
          {status === "PLAYING" ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <TimerIcon
                  className={
                    timeLeft < 10
                      ? "text-accent animate-pulse"
                      : "text-white/40"
                  }
                  size={12}
                />
                <span
                  className={`text-[10px] font-black uppercase tracking-widest ${timeLeft < 10 ? "text-accent" : "text-white/40"}`}
                >
                  {timeLeft}s
                </span>
              </div>
              <span className="text-white font-bold text-xs truncate italic">
                {currentClue}
              </span>
            </>
          ) : (
            <>
              <span className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">
                {status === "JOINING" ? "SPOTIT" : "TEAM"}
              </span>
              <span className="text-white font-bold text-sm truncate uppercase italic tracking-wider">
                {teamName || "WELCOME"}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {status === "PLAYING" && (
            <div className="text-right">
              <span className="text-white/40 text-[10px] font-black uppercase tracking-widest block leading-none">
                Pts
              </span>
              <span className="text-primary font-mono font-black text-xl leading-none">
                {score}
              </span>
            </div>
          )}
          <button
            onClick={handleExit}
            className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 active:bg-accent/20 active:border-accent/50 transition-colors"
          >
            <X className="text-white/40 active:text-accent" size={20} />
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {status === "JOINING" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in">
            <div className="w-full max-w-sm glass rounded-3xl p-8 border border-white/10 shadow-2xl">
              <Zap className="text-primary mx-auto mb-6" size={40} />
              <h1 className="text-2xl font-black text-white text-center mb-8 uppercase italic tracking-wider">
                {teamName ? "Join Team" : "Create Team"}
              </h1>
              <form onSubmit={handleJoin} className="space-y-4">
                {!teamName ? (
                  <input
                    type="text"
                    placeholder="Enter Team Name"
                    maxLength={12}
                    value={teamNameInput}
                    onChange={(e) => setTeamNameInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-lg focus:border-primary outline-none"
                    autoFocus
                  />
                ) : (
                  <div className="text-center py-6 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-white/40 text-xs uppercase mb-1">
                      Team Name
                    </p>
                    <p className="text-xl font-black text-white italic">
                      {teamName}
                    </p>
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full bg-primary py-4 rounded-xl font-black text-white text-lg active:scale-95 transition-transform"
                >
                  {teamName ? "JOIN NOW" : "CONTINUE"}
                </button>
              </form>
            </div>
          </div>
        )}

        {(status === "LOBBY" || status === "RESULTS") && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in">
            <div className="w-full max-w-sm glass rounded-3xl p-8 border border-white/10 text-center shadow-2xl">
              <h1 className="text-3xl font-black text-white mb-8 italic uppercase tracking-tighter">
                {teamName}
              </h1>

              {status === "RESULTS" ? (
                <div className="space-y-6">
                  <div className="bg-yellow-400/10 p-6 rounded-2xl border border-yellow-400/20">
                    <p className="text-yellow-400 font-black text-sm uppercase tracking-widest mb-1">
                      Final Score
                    </p>
                    <p className="text-5xl font-black text-white font-mono">
                      {score}
                    </p>
                  </div>
                  {isLeader ? (
                    <button
                      onClick={handleStartGame}
                      className="w-full bg-primary py-6 rounded-2xl font-black text-white text-xl flex items-center justify-center gap-3 shadow-2xl active:scale-95"
                    >
                      <Play fill="currentColor" size={24} /> RESTART GAME
                    </button>
                  ) : (
                    <p className="text-white/40 font-bold italic animate-pulse">
                      Waiting for leader...
                    </p>
                  )}
                </div>
              ) : isLeader ? (
                <div className="space-y-6">
                  <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20 flex items-center justify-center gap-2 text-primary font-bold">
                    <CheckCircle2 size={20} /> Leader
                  </div>
                  <p className="text-white/40 text-sm">
                    {lobbyInfo.readyCount}/{lobbyInfo.totalPlayers} Players
                    Ready
                  </p>
                  <button
                    onClick={handleStartGame}
                    disabled={!lobbyInfo.allReady}
                    className="w-full bg-primary disabled:opacity-20 py-6 rounded-2xl font-black text-white text-xl flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all"
                  >
                    <Play fill="currentColor" size={24} /> START GAME
                  </button>
                </div>
              ) : !isReady ? (
                <button
                  onClick={handleReady}
                  className="w-full bg-secondary py-6 rounded-2xl font-black text-white text-xl animate-pulse active:scale-95"
                >
                  READY TO PLAY
                </button>
              ) : (
                <div className="flex flex-col items-center gap-6 animate-in">
                  <CheckCircle2 className="text-green-500" size={64} />
                  <p className="text-white font-black text-xl italic uppercase">
                    YOU ARE READY
                  </p>
                  <div className="px-6 py-2 bg-white/5 rounded-full border border-white/10 text-white/60 font-bold">
                    {lobbyInfo.readyCount}/{lobbyInfo.totalPlayers} Ready
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {status === "PLAYING" && (
          <div className="flex-1 flex flex-col p-4 gap-4 animate-in">
            <div
              onTouchMove={handleTouchMove}
              onTouchEnd={() => {
                lastTouchRef.current = null;
              }}
              className="flex-[2] bg-white/5 rounded-[2.5rem] border-2 border-white/10 relative flex flex-col items-center justify-center active:border-primary/50 transition-colors shadow-inner"
            >
              <MousePointer2 className="text-white/10" size={64} />
              <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.4em] mt-4">
                Touchpad
              </p>
              {lastResult === "HIT" && (
                <div className="absolute inset-0 bg-green-500/10 rounded-[2.5rem] animate-pulse" />
              )}
              {lastResult === "MISS" && (
                <div className="absolute inset-0 bg-accent/10 rounded-[2.5rem] animate-pulse" />
              )}
            </div>

            <button
              onClick={() => {
                if (status === "PLAYING") channelRef.current.emit("spotObject");
              }}
              className={`flex-1 rounded-[2.5rem] flex flex-col items-center justify-center transition-all active:scale-95 shadow-2xl ${
                lastResult === "HIT"
                  ? "bg-green-500"
                  : lastResult === "MISS"
                    ? "bg-accent"
                    : "bg-primary"
              }`}
            >
              <Target className="text-white mb-2" size={40} />
              <span className="text-white font-black text-2xl tracking-tighter uppercase italic">
                SPOT OBJECT
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Controller;
