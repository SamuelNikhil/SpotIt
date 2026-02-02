import React from 'react';
import { Trophy, Star, Users, ArrowRight } from 'lucide-react';

const ScoreCard = ({ teamName, score, players, onRestart, onExit, isLeader, isGameOver, timeLeft }) => {
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-[3rem] border border-white/10 p-10 shadow-2xl max-w-2xl w-full animate-in flex flex-col items-center text-center">
      {/* Header Icon */}
      <div className="w-24 h-24 bg-yellow-400/20 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-yellow-400/10">
        <Trophy className="text-yellow-400" size={48} />
      </div>

      {/* Game Status Text */}
      <h2 className="text-5xl font-black italic tracking-tighter mb-2 uppercase text-white">
        {timeLeft === 0 ? "TIME'S UP!" : "CHALLENGE COMPLETE!"}
      </h2>
      <p className="text-white/40 font-black uppercase tracking-[0.3em] mb-8">
        Team Results
      </p>

      {/* Team & Score Main Display */}
      <div className="bg-white/5 rounded-3xl p-8 border border-white/5 w-full mb-8">
        <h3 className="text-primary text-sm font-black uppercase tracking-widest mb-1">Team Name</h3>
        <p className="text-4xl font-black text-white italic mb-6">{teamName}</p>

        <div className="h-px bg-white/10 w-full mb-6" />

        <div className="flex justify-around items-center">
          <div className="flex flex-col">
            <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Total Points</span>
            <span className="text-5xl font-black text-primary font-mono">{score}</span>
          </div>
          <div className="flex flex-col border-l border-white/10 pl-12 text-left">
            <span className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1">
              <Users size={12} /> Players
            </span>
            <div className="flex -space-x-2">
              {players.map((p, i) => (
                <div key={i} className={`w-8 h-8 rounded-full border-2 border-dark flex items-center justify-center text-[10px] font-bold ${
                  i === 0 ? 'bg-primary' : i === 1 ? 'bg-secondary' : 'bg-accent'
                }`}>
                  {p.name.charAt(0)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col w-full gap-4">
        {isLeader ? (
          <button
            onClick={onRestart}
            id="restart-btn"
            className="group relative w-full bg-white text-dark py-6 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
          >
            <Star className="text-primary group-hover:rotate-12 transition-transform" />
            PLAY AGAIN
          </button>
        ) : (
          <div className="py-4 text-white/40 font-bold animate-pulse italic">
            Waiting for Leader to Restart...
          </div>
        )}

        <button
          onClick={onExit}
          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          EXIT TO LOBBY
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default ScoreCard;
