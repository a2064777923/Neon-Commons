const { DEFAULT_TEMPLATE_PRESETS } = require("./game/template-settings");

const TEMPLATE_DEFINITIONS = DEFAULT_TEMPLATE_PRESETS.map((template) => ({
  ...template,
  settings: {
    ...template.settings
  }
}));

const DEFAULT_PARTY_VOICE_ICE_SERVERS = Object.freeze([
  Object.freeze({ urls: "stun:stun.l.google.com:19302" }),
  Object.freeze({ urls: "stun:stun1.l.google.com:19302" })
]);

const DEFAULT_SYSTEM_CONFIG = {
  seasonName: "S1 開服賽季",
  roomExpiryMinutes: 30,
  botFillStrategy: "fill-on-demand",
  maxOpenRoomsPerUser: 3,
  leaderboardRefreshSeconds: 60,
  allowPublicRoomList: true,
  defaultRoomSeatCount: 3,
  maintenanceMode: false,
  baseScorePresets: [20, 50, 100, 300, 1000],
  partyVoiceTransport: {
    startupProbeMs: 4000,
    persistentFailureMs: 6000,
    reconnectGraceSeconds: 45,
    stickyRelay: true,
    resumeMutedOnRecovery: true,
    iceServers: DEFAULT_PARTY_VOICE_ICE_SERVERS
  }
};

module.exports = {
  DEFAULT_PARTY_VOICE_ICE_SERVERS,
  TEMPLATE_DEFINITIONS,
  DEFAULT_SYSTEM_CONFIG
};
