/**
 * Shared Constants for SpotIt
 * Ensures Client (Hostinger) and Server (EC2) stay in sync.
 */

export const GAME_STATUS = {
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  LOBBY: "LOBBY",
  PLAYING: "PLAYING",
  RESULTS: "RESULTS",
  JOINING: "JOINING",
};

export const EVENTS = {
  // Room Management
  PROBE_ROOM: "probeRoom",
  ROOM_INFO: "roomInfo",
  CREATE_ROOM: "createRoom",
  RECOVER_ROOM: "recoverRoom",
  ROOM_CREATED: "roomCreated",
  JOIN_ROOM: "joinRoom",
  JOIN_RESPONSE: "joinResponse",
  EXIT_ROOM: "exitRoom",
  EXITED: "exited",
  
  // Lobby
  LOBBY_UPDATE: "lobbyUpdate",
  SET_READY: "setReady",
  PLAYER_JOINED: "playerJoined",
  PLAYER_LEFT: "playerLeft",
  TEAM_UPDATED: "teamUpdated",
  
  // Game Flow
  START_GAME: "startGame",
  GAME_STARTED: "gameStarted",
  GAME_OVER: "gameOver",
  TIMER_UPDATE: "timerUpdate",
  ROOM_RESET: "roomReset",
  
  // Real-time Gameplay
  CURSOR_UPDATE: "cursorUpdate",
  CURSOR_MOVED: "cursorMoved",
  SPOT_OBJECT: "spotObject",
  SPOT_FEEDBACK: "spotFeedback",
  SPOT_RESULT: "spotResult",
  PRELOAD_IMAGE: "preloadImage",
};

export const GAME_CONFIG = {
  LEVEL_TIME: 30,
  POINTS_PER_HIT: 20,
  MAX_RIDDLES: 8,
  CURSOR_TICK_RATE: 30, // Hz
};
