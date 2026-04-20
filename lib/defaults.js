const TEMPLATE_DEFINITIONS = [
  {
    name: "classic-ranked",
    title: "經典排位房",
    description: "標準三人斗地主，叫分搶地主、炸彈與春天結算。",
    mode: "CLASSIC",
    isActive: true,
    settings: {
      baseScore: 50,
      bidOptions: [0, 1, 2, 3],
      countdownSeconds: 18,
      autoTrusteeMinSeconds: 2,
      autoTrusteeMaxSeconds: 5,
      allowSpring: true,
      allowBomb: true,
      allowRocket: true,
      allowBots: true,
      maxRobMultiplier: 3,
      bombMultiplier: 2,
      rocketMultiplier: 2,
      springMultiplier: 2,
      roomVisibility: "public"
    }
  },
  {
    name: "rob-fast",
    title: "搶地主快開房",
    description: "更快的節奏，叫地主與加倍流程簡化，適合好友局。",
    mode: "ROB",
    isActive: true,
    settings: {
      baseScore: 100,
      bidOptions: [0, 1, 2, 3],
      countdownSeconds: 15,
      autoTrusteeMinSeconds: 2,
      autoTrusteeMaxSeconds: 4,
      allowSpring: true,
      allowBomb: true,
      allowRocket: true,
      allowBots: true,
      maxRobMultiplier: 4,
      bombMultiplier: 2,
      rocketMultiplier: 2,
      springMultiplier: 2,
      roomVisibility: "public"
    }
  },
  {
    name: "no-shuffle-social",
    title: "不洗牌娛樂房",
    description: "使用固定牌序發牌的娛樂模式，適合測試與熟人對局。",
    mode: "NO_SHUFFLE",
    isActive: true,
    settings: {
      baseScore: 200,
      bidOptions: [0, 1, 2, 3],
      countdownSeconds: 16,
      autoTrusteeMinSeconds: 2,
      autoTrusteeMaxSeconds: 5,
      allowSpring: true,
      allowBomb: true,
      allowRocket: true,
      allowBots: true,
      maxRobMultiplier: 4,
      bombMultiplier: 2,
      rocketMultiplier: 2,
      springMultiplier: 2,
      roomVisibility: "private"
    }
  },
  {
    name: "laizi-beta",
    title: "癩子實驗房",
    description: "預留癩子玩法模板，首版先保留配置入口，默認關閉。",
    mode: "LAIZI",
    isActive: false,
    settings: {
      baseScore: 100,
      bidOptions: [0, 1, 2, 3],
      countdownSeconds: 16,
      autoTrusteeMinSeconds: 2,
      autoTrusteeMaxSeconds: 4,
      allowSpring: true,
      allowBomb: true,
      allowRocket: true,
      allowBots: true,
      maxRobMultiplier: 4,
      bombMultiplier: 2,
      rocketMultiplier: 2,
      springMultiplier: 2,
      roomVisibility: "private"
    }
  }
];

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
