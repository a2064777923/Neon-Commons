const GAME_CATALOG = {
  doudezhu: {
    key: "doudezhu",
    title: "斗地主",
    shortTitle: "DDZ",
    strapline: "三人明牌压制、炸弹翻倍、手牌滑选",
    description:
      "沉浸式牌桌、房间号开局、机器人补位、排行榜和后台规则配置都已经接通。",
    players: "3 人",
    route: "/lobby",
    accent: "gold",
    features: ["滑动选牌", "炸弹倍率", "机器人补位", "沉浸式音效"],
    audience: "适合 3 人快节奏对抗"
  },
  werewolf: {
    key: "werewolf",
    title: "在线狼人杀",
    shortTitle: "Werewolf",
    strapline: "夜晚神职操作、白天讨论投票、房内语音直连",
    description:
      "支持 6-10 人开房，现已扩展到狼人、预言家、女巫、守卫、猎人与村民，并支持补 AI 自动跑完整昼夜流程。",
    players: "6-10 人",
    route: "/games/werewolf",
    accent: "crimson",
    features: ["扩展身份池", "补 AI 开局", "昼夜阶段", "语音通话"],
    audience: "适合熟人局推理与发言压迫"
  },
  avalon: {
    key: "avalon",
    title: "在线阿瓦隆",
    shortTitle: "Avalon",
    strapline: "组队、表决、任务成败与刺杀梅林",
    description:
      "支持 5-10 人房间，现已加入莫德雷德与奥伯伦，并支持机器人补位、自动组队、任务暗投与刺杀流程。",
    players: "5-10 人",
    route: "/games/avalon",
    accent: "royal",
    features: ["扩展身份池", "补 AI 开局", "任务牌暗投", "语音通话"],
    audience: "适合中高强度阵营博弈"
  },
  gomoku: {
    key: "gomoku",
    title: "在线五子棋",
    shortTitle: "Gomoku",
    strapline: "15 路棋盘、先手抢势、五连即胜",
    description:
      "支持 2 人房间、房号加入、补 AI 开局与实时落子同步，适合快速对弈和移动端触屏落点。",
    players: "2 人",
    route: "/games/gomoku",
    accent: "jade",
    features: ["15 路棋盘", "补 AI 开局", "实时落子", "移动端适配"],
    audience: "适合短局高频博弈"
  },
  chinesecheckers: {
    key: "chinesecheckers",
    title: "在线跳棋",
    shortTitle: "Jump Chess",
    strapline: "六角星盘、完整营地对冲、连跳抢线",
    description:
      "支持 2 / 4 / 6 人完整中国跳棋房，带六营地星盘、高亮合法落点、补 AI 开局和实时同步。",
    players: "2 / 4 / 6 人",
    route: "/games/chinesecheckers",
    accent: "sky",
    features: ["六营地星盘", "2/4/6 人房", "连跳走位", "补 AI 开局"],
    audience: "适合多人布局穿插与位移计算"
  }
};

const PARTY_GAME_KEYS = ["werewolf", "avalon"];
const BOARD_GAME_KEYS = ["gomoku", "chinesecheckers"];

function getGameMeta(gameKey) {
  return GAME_CATALOG[gameKey] || null;
}

function getGameMode(gameKey) {
  if (PARTY_GAME_KEYS.includes(gameKey)) {
    return "party";
  }

  if (BOARD_GAME_KEYS.includes(gameKey)) {
    return "board";
  }

  if (gameKey === "doudezhu") {
    return "card";
  }

  return null;
}

function getPartyDefaultConfig(gameKey) {
  if (gameKey === "werewolf") {
    return {
      visibility: "public",
      maxPlayers: 8,
      nightSeconds: 45,
      discussionSeconds: 70,
      voteSeconds: 35,
      hunterSeconds: 20,
      voiceEnabled: true
    };
  }

  if (gameKey === "avalon") {
    return {
      visibility: "public",
      maxPlayers: 7,
      teamBuildSeconds: 45,
      voteSeconds: 30,
      questSeconds: 25,
      assassinSeconds: 30,
      voiceEnabled: true
    };
  }

  return {};
}

function getBoardDefaultConfig(gameKey) {
  if (gameKey === "gomoku") {
    return {
      visibility: "public",
      maxPlayers: 2,
      turnSeconds: 25
    };
  }

  if (gameKey === "chinesecheckers") {
    return {
      visibility: "public",
      maxPlayers: 2,
      turnSeconds: 30
    };
  }

  return {};
}

function getGameLimits(gameKey) {
  if (gameKey === "werewolf") {
    return { minPlayers: 6, maxPlayers: 10 };
  }

  if (gameKey === "avalon") {
    return { minPlayers: 5, maxPlayers: 10 };
  }

  if (gameKey === "chinesecheckers") {
    return { minPlayers: 2, maxPlayers: 6 };
  }

  if (gameKey === "gomoku") {
    return { minPlayers: 2, maxPlayers: 2 };
  }

  return { minPlayers: 0, maxPlayers: 0 };
}

function getBoardPlayerOptions(gameKey) {
  if (gameKey === "chinesecheckers") {
    return [2, 4, 6];
  }

  if (gameKey === "gomoku") {
    return [2];
  }

  return [];
}

module.exports = {
  GAME_CATALOG,
  PARTY_GAME_KEYS,
  BOARD_GAME_KEYS,
  getGameMeta,
  getGameMode,
  getPartyDefaultConfig,
  getBoardDefaultConfig,
  getGameLimits,
  getBoardPlayerOptions
};
