const { DEFAULT_TEMPLATE_PRESETS } = require("./game/template-settings");

const TEMPLATE_DEFINITIONS = DEFAULT_TEMPLATE_PRESETS.map((template) => ({
  ...template,
  settings: {
    ...template.settings
  }
}));

const DEFAULT_SYSTEM_CONFIG = {
  seasonName: "S1 開服賽季",
  roomExpiryMinutes: 30,
  botFillStrategy: "fill-on-demand",
  maxOpenRoomsPerUser: 3,
  leaderboardRefreshSeconds: 60,
  allowPublicRoomList: true,
  defaultRoomSeatCount: 3,
  maintenanceMode: false,
  baseScorePresets: [20, 50, 100, 300, 1000]
};

module.exports = {
  TEMPLATE_DEFINITIONS,
  DEFAULT_SYSTEM_CONFIG
};
