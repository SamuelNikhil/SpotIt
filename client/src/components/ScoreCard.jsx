import React from "react";
import { Trophy, Star, Users, ArrowRight } from "lucide-react";

const ScoreCard = ({
  teamName,
  score,
  players,
  onRestart,
  onExit,
  isLeader,
  timeLeft,
}) => {
  return (
    <div
      className="animate-in no-scrollbar"
      style={{
        padding: "2.5rem",
        maxWidth: "550px",
        width: "95%",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        maxHeight: "90vh",
        overflowY: "auto",
        gap: "1.5rem",
        position: "relative",
        zIndex: 100,
        background: "transparent",
        border: "none",
        boxShadow: "none",
      }}
    >
      {/* Header Icon */}
      <div
        style={{
          width: "70px",
          height: "70px",
          background: "rgba(250, 204, 21, 0.1)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 0 30px rgba(250, 204, 21, 0.1)",
        }}
      >
        <Trophy size={36} color="#facc15" />
      </div>

      {/* Status Text */}
      <div style={{ flexShrink: 0 }}>
        <h2
          style={{
            fontSize: "clamp(1.5rem, 6vh, 3rem)",
            fontWeight: 900,
            fontStyle: "italic",
            letterSpacing: "-1px",
            textTransform: "uppercase",
            marginBottom: "0.25rem",
            color: "white",
            lineHeight: 1,
          }}
        >
          {timeLeft === 0 ? "Time's Up!" : "Complete!"}
        </h2>
        <p
          style={{
            fontSize: "9px",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "3px",
            opacity: 0.4,
          }}
        >
          Mission Briefing
        </p>
      </div>

      {/* Main Results Panel */}
      <div
        style={{
          width: "100%",
          background: "rgba(255, 255, 255, 0.03)",
          borderRadius: "24px",
          padding: "1.5rem",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              color: "var(--accent-primary)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              display: "block",
              marginBottom: "0.25rem",
            }}
          >
            Team Name
          </span>
          <p
            style={{
              fontSize: "1.75rem",
              fontWeight: 900,
              fontStyle: "italic",
              color: "white",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {teamName || "Spotters"}
          </p>
        </div>

        <div
          style={{
            height: "1px",
            background: "rgba(255, 255, 255, 0.12)",
            width: "100%",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 0.5rem",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <span
              style={{
                fontSize: "9px",
                fontWeight: 900,
                opacity: 0.4,
                textTransform: "uppercase",
                letterSpacing: "1px",
                display: "block",
              }}
            >
              Total Score
            </span>
            <span
              style={{
                fontSize: "clamp(2.5rem, 5vh, 4rem)",
                fontWeight: 900,
                color: "var(--accent-primary)",
                fontFamily: "monospace",
                lineHeight: 1,
              }}
            >
              {score}
            </span>
          </div>

          <div
            style={{
              width: "1px",
              height: "40px",
              background: "rgba(255, 255, 255, 0.12)",
            }}
          />

          <div style={{ textAlign: "right" }}>
            <span
              style={{
                fontSize: "9px",
                fontWeight: 900,
                opacity: 0.4,
                textTransform: "uppercase",
                letterSpacing: "1px",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "4px",
                marginBottom: "6px",
              }}
            >
              <Users size={10} /> Players
            </span>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {players?.map((p, i) => (
                <div
                  key={i}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background:
                      i === 0
                        ? "var(--accent-primary)"
                        : i === 1
                          ? "var(--accent-secondary)"
                          : "var(--accent-tertiary)",
                    border: "2px solid var(--bg-dark)",
                    marginLeft: i === 0 ? 0 : "-8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "9px",
                    fontWeight: 900,
                    color: i === 2 ? "var(--bg-dark)" : "white",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          flexShrink: 0,
        }}
      >
        {isLeader ? (
          <button
            onClick={onRestart}
            className="spot-btn"
            style={{
              margin: 0,
              padding: "1rem",
              background: "white",
              color: "var(--bg-dark)",
              fontSize: "1.2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              width: "100%",
              height: "auto",
              flex: "none",
            }}
          >
            <Star
              fill="var(--accent-primary)"
              color="var(--accent-primary)"
              size={20}
            />
            <span>PLAY AGAIN</span>
          </button>
        ) : (
          <div
            style={{
              padding: "1rem",
              borderRadius: "20px",
              background: "rgba(255, 255, 255, 0.02)",
              color: "rgba(255, 255, 255, 0.3)",
              fontWeight: 800,
              fontStyle: "italic",
              fontSize: "0.85rem",
            }}
          >
            Waiting for leader to restart...
          </div>
        )}

        <button
          onClick={onExit}
          style={{
            background: "none",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "white",
            padding: "0.75rem",
            borderRadius: "20px",
            fontWeight: 800,
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            cursor: "pointer",
            opacity: 0.5,
            transition: "all 0.2s",
            width: "100%",
          }}
        >
          EXIT TO LOBBY <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default ScoreCard;
