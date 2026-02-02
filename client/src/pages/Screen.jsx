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

const Screen = () => {
  const [roomId, setRoomId] = useState(null);
  const [joinToken, setJoinToken] = useState(null);
  const [players, setPlayers] = useState([]);
  const [teamName, setTeamName] = useState("Waiting for Team...");
  const [status, setStatus] = useState("CONNECTING"); // CONNECTING, LOBBY, PLAYING, RESULTS
  const [currentImage, setCurrentImage] = useState({
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=2000",
  });
  const [currentClue, setCurrentClue] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [feedbacks, setFeedbacks] = useState([]);
  const [results, setResults] = useState(null);
  const [isResetting, setIsResetting] = useState(false);

  const channelRef = useRef(null);

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
      if (error) return;
      channelRef.current = channel;
      setStatus("CONNECTED");
      channel.emit("createRoom");
    });

    channel.on("roomCreated", ({ roomId, token, image }) => {
      setRoomId(roomId);
      setJoinToken(token);
      if (image) setCurrentImage(image);
      setStatus("LOBBY");
      setIsResetting(false);
    });

    channel.on("roomReset", (finalResults) => {
      // Show results for 3 seconds before switching back to QR
      setResults(finalResults);
      setStatus("RESULTS");
      setIsResetting(true);

      setTimeout(() => {
        setResults(null);
        setPlayers([]);
        setTeamName("Waiting for Team...");
        setStatus("LOBBY");
        setIsResetting(false);
        if (channelRef.current) {
          channelRef.current.emit("createRoom");
        }
      }, 3000);
    });

    channel.on("lobbyUpdate", (state) => {
      // Only update if we aren't in the middle of a reset transition
      if (state.teamName) setTeamName(state.teamName);
      if (state.status === "LOBBY") {
        setStatus("LOBBY");
        setResults(null);
      }
    });

    channel.on("teamUpdated", ({ teamName }) => {
      setTeamName(teamName);
    });

    channel.on("playerJoined", (player) => {
      setPlayers((prev) => [
        ...prev,
        { ...player, score: 0, cursorX: 50, cursorY: 50 },
      ]);
    });

    channel.on("playerLeft", ({ id }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    });

    channel.on("gameStarted", ({ clue }) => {
      setCurrentClue(clue);
      setStatus("PLAYING");
      setResults(null);
      setTimeLeft(30);
    });

    channel.on("timerUpdate", ({ timeLeft }) => {
      setTimeLeft(timeLeft);
    });

    channel.on("cursorMoved", ({ playerId, x, y }) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId ? { ...p, cursorX: x, cursorY: y } : p,
        ),
      );
    });

    channel.on("spotFeedback", (data) => {
      const { type, x, y, playerId, newScore, nextClue, isGameOver } = data;

      if (type === "HIT") {
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, score: newScore } : p)),
        );
        if (nextClue) setCurrentClue(nextClue);
      }

      const feedbackId = Math.random().toString(36).substr(2, 9);
      setFeedbacks((prev) => [...prev, { id: feedbackId, type, x, y }]);
      setTimeout(() => {
        setFeedbacks((prev) => prev.filter((f) => f.id !== feedbackId));
      }, 1000);
    });

    channel.on("gameOver", (gameResults) => {
      setResults(gameResults);
      setStatus("RESULTS");
    });

    return () => {
      if (channelRef.current) channelRef.current.close();
    };
  }, []);

  const getJoinUrl = () => {
    return `${window.location.origin}/join/${roomId}/${joinToken}`;
  };

  if (status === "CONNECTING") {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary mb-4"></div>
        <p className="text-xl font-medium tracking-wide italic text-white/60">
          Initializing SpotIt...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark text-white overflow-hidden font-sans select-none">
      <header className="h-20 bg-dark/50 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <Target className="text-white" size={24} />
          </div>
          <h1 className="text-3xl font-black tracking-tighter italic">
            SPOTIT
          </h1>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end mr-4">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
              Team
            </span>
            <span className="text-lg font-bold text-primary italic leading-none">
              {teamName}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <Users className="text-secondary" size={20} />
            <span className="font-bold">{players.length} Players</span>
          </div>
          {status === "PLAYING" && (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 animate-in ${timeLeft < 10 ? "bg-accent/20 border-accent/50" : "bg-white/5"}`}
            >
              <Timer
                className={
                  timeLeft < 10 ? "text-accent animate-pulse" : "text-accent"
                }
                size={20}
              />
              <span
                className={`font-mono font-bold text-xl ${timeLeft < 10 ? "text-accent" : ""}`}
              >
                {timeLeft}s
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex h-[calc(100vh-80px)] p-8 gap-8">
        <div className="flex-1 bg-white/5 rounded-[3rem] border border-white/10 relative overflow-hidden shadow-2xl flex items-center justify-center">
          {(status === "LOBBY" || status === "CONNECTED") && !isResetting ? (
            <div className="flex flex-col items-center justify-center w-full h-full p-4">
              <div className="bg-white p-4 rounded-[2rem] shadow-2xl animate-in mb-6 flex items-center justify-center shrink">
                {roomId && (
                  <QRCodeSVG
                    value={getJoinUrl()}
                    size={240}
                    level={"M"}
                    includeMargin={false}
                  />
                )}
              </div>
              <h2 className="text-5xl font-black mb-4 italic tracking-tighter uppercase">
                SCAN TO JOIN
              </h2>
              <p className="text-white/40 text-lg uppercase tracking-[0.2em]">
                Team Leader sets name & starts game
              </p>
            </div>
          ) : status === "RESULTS" || isResetting ? (
            <ScoreCard
              teamName={results?.teamName}
              score={results?.totalScore}
              players={results?.players || []}
              isLeader={players.find((p) => p.isLeader)?.isReady}
              timeLeft={results?.timeLeft ?? timeLeft}
              onRestart={() => channelRef.current?.emit("startGame")}
              onExit={() => {
                channelRef.current?.emit("exitRoom");
              }}
            />
          ) : (
            <div className="relative w-full h-full">
              <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
                style={{ backgroundImage: `url(${currentImage.url})` }}
              >
                <div className="absolute inset-0 bg-black/10" />
              </div>

              {feedbacks.map((f) => (
                <div
                  key={f.id}
                  style={{ left: `${f.x}%`, top: `${f.y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-8 rounded-full animate-ping duration-1000 z-10 ${
                    f.type === "HIT" ? "border-green-500" : "border-accent"
                  }`}
                />
              ))}

              {players.map((p, i) => (
                <div
                  key={p.id}
                  className="absolute transition-all duration-75 ease-out z-50 pointer-events-none"
                  style={{ left: `${p.cursorX}%`, top: `${p.cursorY}%` }}
                >
                  <div className="relative -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                    <div
                      className={`w-14 h-14 border-4 rounded-full border-dashed animate-spin-slow ${
                        i === 0
                          ? "border-primary"
                          : i === 1
                            ? "border-secondary"
                            : "border-accent"
                      }`}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-lg" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="w-80 flex flex-col">
          {status === "PLAYING" ? (
            <div className="bg-white/5 rounded-[2.5rem] border border-white/10 p-8 flex-1 shadow-xl flex flex-col animate-in">
              <div className="flex items-center gap-3 mb-8">
                <HelpCircle className="text-primary" size={28} />
                <h3 className="text-2xl font-black italic tracking-tight uppercase text-white/80">
                  THE CLUE
                </h3>
              </div>
              <div className="bg-white/5 rounded-3xl p-6 border border-white/10 flex-1 flex flex-col items-center justify-center text-center">
                <Sparkles className="text-primary/40 mb-4" size={48} />
                <p className="text-2xl font-black leading-tight italic">
                  "{currentClue}"
                </p>
              </div>
              <div className="mt-8 pt-8 border-t border-white/10">
                <div className="flex justify-between items-center mb-2 text-white/40">
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    PROGRESS
                  </span>
                  <span className="text-primary font-mono font-bold">
                    {players.reduce((acc, p) => acc + p.score, 0)} Pts
                  </span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-[2px]">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (players.reduce((acc, p) => acc + p.score, 0) / 100) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 rounded-[2.5rem] border border-white/10 p-8 flex-1 shadow-xl flex flex-col animate-in">
              <div className="flex items-center gap-3 mb-8">
                <Trophy className="text-yellow-400" size={28} />
                <h3 className="text-2xl font-black italic tracking-tight uppercase">
                  LEADERBOARD
                </h3>
              </div>
              <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar">
                {players
                  .sort((a, b) => b.score - a.score)
                  .map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-white/30 font-black italic text-xl">
                          #0{i + 1}
                        </span>
                        <span className="font-bold text-lg truncate max-w-[100px]">
                          {p.name}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-mono font-black text-2xl text-primary">
                          {p.score}
                        </span>
                        {p.isReady && (
                          <span className="text-[10px] text-green-400 font-black uppercase">
                            Ready
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                {players.length === 0 && (
                  <div className="text-center py-20 opacity-20 flex flex-col items-center justify-center h-full">
                    <Users size={48} className="mb-4" />
                    <p className="font-bold uppercase tracking-widest text-sm text-center leading-tight">
                      Waiting for Team...
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
