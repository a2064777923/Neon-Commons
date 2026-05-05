const GAME_FAMILY_CATALOG = Object.freeze({
  card: Object.freeze({
    key: "card",
    label: "經典牌桌",
    strapline: "經典房號對桌、快節奏重開、隨時能進房接局。",
    hubOrder: 10
  }),
  party: Object.freeze({
    key: "party",
    label: "推理派對",
    strapline: "多人語音、身份博弈、一起把氣氛拉滿。",
    hubOrder: 20
  }),
  board: Object.freeze({
    key: "board",
    label: "棋盤對戰",
    strapline: "短局對弈到多人布局，適合連續開桌。",
    hubOrder: 30
  }),
  solo: Object.freeze({
    key: "solo",
    label: "單人闖關",
    strapline: "低門檻即開即玩，適合補空檔和留存。",
    hubOrder: 40
  }),
  "light-3d": Object.freeze({
    key: "light-3d",
    label: "輕量 3D",
    strapline: "更熱鬧、更輕爽的立體派對感入口。",
    hubOrder: 50
  })
});

function createGameEntry(entry) {
  return Object.freeze({
    roomRoute: entry.route || "",
    detailRoutePrefix: "",
    supportsShareLink: false,
    guestMode: "login-only",
    launchState: "live",
    launchMode: "room",
    capabilityManaged: true,
    hubOrder: 999,
    discoveryTags: [],
    isShipped: false,
    ...entry
  });
}

const GAME_CATALOG = Object.freeze({
  doudezhu: createGameEntry({
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
    audience: "适合 3 人快节奏对抗",
    familyKey: "card",
    hubOrder: 10,
    detailRoutePrefix: "/room",
    supportsShareLink: true,
    guestMode: "login-only",
    launchState: "live",
    discoveryTags: ["經典", "快桌"],
    isShipped: true
  }),
  werewolf: createGameEntry({
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
    audience: "适合熟人局推理与发言压迫",
    familyKey: "party",
    hubOrder: 10,
    detailRoutePrefix: "/party",
    supportsShareLink: true,
    guestMode: "invite-private-only",
    launchState: "live",
    discoveryTags: ["多人", "語音"],
    isShipped: true
  }),
  avalon: createGameEntry({
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
    audience: "适合中高强度阵营博弈",
    familyKey: "party",
    hubOrder: 20,
    detailRoutePrefix: "/party",
    supportsShareLink: true,
    guestMode: "invite-private-only",
    launchState: "live",
    discoveryTags: ["多人", "任務"],
    isShipped: true
  }),
  gomoku: createGameEntry({
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
    audience: "适合短局高频博弈",
    familyKey: "board",
    hubOrder: 10,
    detailRoutePrefix: "/board",
    supportsShareLink: true,
    guestMode: "invite-private-only",
    launchState: "live",
    discoveryTags: ["對弈", "快局"],
    isShipped: true
  }),
  chinesecheckers: createGameEntry({
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
    audience: "适合多人布局穿插与位移计算",
    familyKey: "board",
    hubOrder: 20,
    detailRoutePrefix: "/board",
    supportsShareLink: true,
    guestMode: "invite-private-only",
    launchState: "live",
    discoveryTags: ["多人", "策略"],
    isShipped: true
  }),
  uno: createGameEntry({
    key: "uno",
    title: "UNO 類",
    shortTitle: "UNO",
    strapline: "换色、叠牌、反转节奏的快桌卡牌局",
    description: "保留在經典牌桌家族中，完成後可直接接入房號與邀請入口。",
    players: "2-6 人",
    route: "",
    accent: "gold",
    features: ["換色", "反轉", "叠牌"],
    audience: "適合輕鬆熱場",
    familyKey: "card",
    hubOrder: 20,
    launchState: "coming-soon",
    discoveryTags: ["多人", "卡牌"]
  }),
  undercover: createGameEntry({
    key: "undercover",
    title: "誰是臥底",
    shortTitle: "Undercover",
    strapline: "詞題分歧、輪流描述、抓出那個不對勁的人",
    description: "建立房間後即可進入獨立派對房，支援邀請連結、補 AI 與專屬臥底回合流程。",
    players: "4-10 人",
    route: "/games/undercover",
    accent: "crimson",
    features: ["描述輪次", "臥底判定", "社交推理"],
    audience: "適合熟人局暖場",
    familyKey: "party",
    hubOrder: 30,
    detailRoutePrefix: "/undercover",
    supportsShareLink: true,
    guestMode: "invite-private-only",
    launchState: "live",
    discoveryTags: ["多人", "推理"],
    isShipped: true
  }),
  drawguess: createGameEntry({
    key: "drawguess",
    title: "你畫我猜",
    shortTitle: "Draw & Guess",
    strapline: "即時畫板、接力猜詞、派對節奏很快",
    description: "支援 3-10 人接力畫詞與猜詞，沿用房號、邀請、語音與派對房回復流程。",
    players: "3-10 人",
    route: "/games/drawguess",
    accent: "crimson",
    features: ["即時畫板", "輪流作畫", "猜詞搶分", "語音派對"],
    audience: "適合派對活躍氣氛",
    familyKey: "party",
    hubOrder: 40,
    detailRoutePrefix: "/party",
    supportsShareLink: true,
    guestMode: "invite-private-only",
    launchState: "live",
    discoveryTags: ["多人", "互動"],
    isShipped: true
  }),
  reversi: createGameEntry({
    key: "reversi",
    title: "黑白棋",
    shortTitle: "Reversi",
    strapline: "角位争夺、翻面反杀、短局也有层次",
    description: "可建立雙人對戰房，直接沿用房號、邀請連結與補 AI 棋局流程。",
    players: "2 人",
    route: "/games/reversi",
    accent: "jade",
    features: ["翻子", "角位", "短局"],
    audience: "適合快節奏雙人對弈",
    familyKey: "board",
    hubOrder: 30,
    detailRoutePrefix: "/reversi",
    supportsShareLink: true,
    guestMode: "invite-private-only",
    launchState: "live",
    discoveryTags: ["雙人", "棋盤"],
    isShipped: true
  }),
  flyingchess: createGameEntry({
    key: "flyingchess",
    title: "飛行棋",
    shortTitle: "Flying Chess",
    strapline: "摇骰冲线、卡位撞回、多人节奏明快",
    description: "支持 2-4 人经典飞行棋房，完整接入房号、邀请、断线恢复与共享棋盘房流程。",
    players: "2-4 人",
    route: "/games/flyingchess",
    accent: "sky",
    features: ["擲骰起飛", "撞回機場", "飛線跳點", "2-4 人對局"],
    audience: "適合朋友局休閒互坑",
    familyKey: "board",
    hubOrder: 40,
    detailRoutePrefix: "/board",
    supportsShareLink: true,
    guestMode: "invite-private-only",
    launchState: "live",
    discoveryTags: ["多人", "休閒"],
    isShipped: true
  }),
  pickred: createGameEntry({
    key: "pickred",
    title: "撿紅點",
    shortTitle: "撿紅點",
    strapline: "十點配對、紅牌得分、快節奏雙人卡牌",
    description: "兩人卡牌對局，從手牌與桌牌中湊出總和為 10 的紅牌配對，回合結束時紅牌點數高者獲勝。",
    players: "2 人",
    route: "/games/pickred",
    accent: "crimson",
    features: ["十點配對", "紅牌計分", "回合計時", "斷線恢復"],
    audience: "適合雙人快節奏對局",
    familyKey: "card",
    hubOrder: 30,
    detailRoutePrefix: "/pickred",
    supportsShareLink: true,
    guestMode: "login-only",
    launchState: "coming-soon",
    discoveryTags: ["卡牌", "雙人", "快局"],
    isShipped: false
  }),
  bigtwo: createGameEntry({
    key: "bigtwo",
    title: "大老二",
    shortTitle: "Big Two",
    strapline: "四人撲克、非標準排名、快節奏卡牌對局",
    description: "四人卡牌對局，使用標準 52 張牌，2 為最大牌，玩家輪流出牌或過牌，先出完手牌者獲勝。",
    players: "4 人",
    route: "/games/bigtwo",
    accent: "crimson",
    features: ["非標準排名", "四人對局", "多種牌型", "斷線恢復"],
    audience: "適合四人快節奏撲克對局",
    familyKey: "card",
    hubOrder: 40,
    detailRoutePrefix: "/bigtwo",
    supportsShareLink: true,
    guestMode: "login-only",
    launchState: "coming-soon",
    discoveryTags: ["卡牌", "四人", "撲克"],
    isShipped: false
  }),
  mahjong: createGameEntry({
    key: "mahjong",
    title: "麻將",
    shortTitle: "Mahjong",
    strapline: "四人麻將、吃碰槓胡、番數計分",
    description: "四人麻將對局，144 張牌，支援吃碰槓胡、花牌補牌、番數計分與斷線恢復。",
    players: "4 人",
    route: "/games/mahjong",
    accent: "crimson",
    features: ["吃碰槓胡", "花牌補牌", "番數計分", "斷線恢復"],
    audience: "適合四人經典麻將對局",
    familyKey: "card",
    hubOrder: 50,
    detailRoutePrefix: "/mahjong",
    supportsShareLink: true,
    guestMode: "login-only",
    launchState: "coming-soon",
    discoveryTags: ["卡牌", "四人", "麻將"],
    isShipped: false
  }),
  sokoban: createGameEntry({
    key: "sokoban",
    title: "推箱子",
    shortTitle: "Sokoban",
    strapline: "單人闖關、關卡遞進、很適合補空檔",
    description: "直接開始，不需房號；內建關卡包、步數統計與觸控 / 鍵盤操作一併就位。",
    players: "1 人",
    route: "/games/sokoban",
    accent: "jade",
    features: ["單人", "關卡", "闖關"],
    audience: "適合單人留存",
    familyKey: "solo",
    hubOrder: 10,
    launchState: "live",
    launchMode: "direct",
    capabilityManaged: false,
    discoveryTags: ["單人", "闖關"],
    isShipped: true
  }),
  bowling: createGameEntry({
    key: "bowling",
    title: "保齡球",
    shortTitle: "Bowling",
    strapline: "直覺出手、輕量立體表現、適合派對穿插",
    description: "預留在輕量 3D 家族，後續完成後可直接接入房號分享。",
    players: "1-4 人",
    route: "",
    accent: "royal",
    features: ["3D", "派對", "輕操作"],
    audience: "適合快速輪轉對戰",
    familyKey: "light-3d",
    hubOrder: 10,
    launchState: "coming-soon",
    discoveryTags: ["3D", "多人"]
  }),
  racing: createGameEntry({
    key: "racing",
    title: "賽車",
    shortTitle: "Racing",
    strapline: "3D 賽道、即時物理、多人競速",
    description: "支援 2-4 人即時 3D 賽車房，cannon-es 物理引擎驅動，含圈數計時、觀戰模式與斷線恢復。",
    players: "2-4 人",
    route: "/games/racing",
    accent: "royal",
    features: ["3D 賽道", "即時物理", "圈數計時", "觀戰模式"],
    audience: "適合多人即時競速",
    familyKey: "light-3d",
    hubOrder: 10,
    detailRoutePrefix: "/racing",
    supportsShareLink: true,
    guestMode: "login-only",
    launchState: "coming-soon",
    discoveryTags: ["3D", "競速", "多人"],
    isShipped: false
  })
});

const PARTY_GAME_KEYS = Object.freeze(["werewolf", "avalon", "undercover", "drawguess"]);
const BOARD_GAME_KEYS = Object.freeze(["gomoku", "chinesecheckers", "reversi", "flyingchess"]);
const BOARD_OPENING_RULES = Object.freeze({
  gomoku: Object.freeze([
    Object.freeze({
      key: "standard",
      label: "标准开局",
      description: "首手可落在任意空位"
    }),
    Object.freeze({
      key: "center-opening",
      label: "天元开局",
      description: "首手必须落在棋盘中心"
    })
  ])
});
const PARTY_ROLE_LABELS = Object.freeze({
  werewolf: Object.freeze({
    werewolf: "狼人",
    seer: "预言家",
    witch: "女巫",
    guard: "守卫",
    hunter: "猎人",
    villager: "村民"
  }),
  avalon: Object.freeze({
    merlin: "梅林",
    percival: "派西维尔",
    loyal: "忠臣",
    assassin: "刺客",
    minion: "爪牙",
    morgana: "莫甘娜",
    mordred: "莫德雷德",
    oberon: "奥伯伦"
  })
});
const PARTY_ROLE_PACKS = Object.freeze({
  werewolf: Object.freeze({
    standard: Object.freeze({
      key: "standard",
      label: "標準局",
      description: "保留目前已上線的守衛與獵人配置，適合完整推理局。",
      default: true,
      defaultPlayerCount: 8,
      rolesByCount: Object.freeze({
        6: ["werewolf", "werewolf", "seer", "witch", "guard", "villager"],
        7: ["werewolf", "werewolf", "seer", "witch", "guard", "hunter", "villager"],
        8: [
          "werewolf",
          "werewolf",
          "seer",
          "witch",
          "guard",
          "hunter",
          "villager",
          "villager"
        ],
        9: [
          "werewolf",
          "werewolf",
          "werewolf",
          "seer",
          "witch",
          "guard",
          "hunter",
          "villager",
          "villager"
        ],
        10: [
          "werewolf",
          "werewolf",
          "werewolf",
          "seer",
          "witch",
          "guard",
          "hunter",
          "villager",
          "villager",
          "villager"
        ]
      })
    }),
    casual: Object.freeze({
      key: "casual",
      label: "輕量局",
      description: "減少高壓神職與反擊角色，讓新手局更容易推進。",
      default: false,
      defaultPlayerCount: 8,
      rolesByCount: Object.freeze({
        6: ["werewolf", "werewolf", "seer", "witch", "villager", "villager"],
        7: ["werewolf", "werewolf", "seer", "witch", "guard", "villager", "villager"],
        8: [
          "werewolf",
          "werewolf",
          "seer",
          "witch",
          "guard",
          "villager",
          "villager",
          "villager"
        ],
        9: [
          "werewolf",
          "werewolf",
          "werewolf",
          "seer",
          "witch",
          "guard",
          "villager",
          "villager",
          "villager"
        ],
        10: [
          "werewolf",
          "werewolf",
          "werewolf",
          "seer",
          "witch",
          "guard",
          "villager",
          "villager",
          "villager",
          "villager"
        ]
      })
    })
  }),
  avalon: Object.freeze({
    advanced: Object.freeze({
      key: "advanced",
      label: "擴展局",
      description: "保留目前已上線的莫德雷德與奧伯倫配置，資訊差更強。",
      default: true,
      defaultPlayerCount: 7,
      rolesByCount: Object.freeze({
        5: ["merlin", "assassin", "minion", "loyal", "loyal"],
        6: ["merlin", "percival", "assassin", "morgana", "loyal", "loyal"],
        7: ["merlin", "percival", "assassin", "morgana", "mordred", "loyal", "loyal"],
        8: [
          "merlin",
          "percival",
          "assassin",
          "morgana",
          "oberon",
          "loyal",
          "loyal",
          "loyal"
        ],
        9: [
          "merlin",
          "percival",
          "assassin",
          "morgana",
          "mordred",
          "loyal",
          "loyal",
          "loyal",
          "loyal"
        ],
        10: [
          "merlin",
          "percival",
          "assassin",
          "morgana",
          "mordred",
          "oberon",
          "loyal",
          "loyal",
          "loyal",
          "loyal"
        ]
      })
    }),
    classic: Object.freeze({
      key: "classic",
      label: "經典局",
      description: "去掉莫德雷德 / 奧伯倫，用較穩定的經典身份池跑局。",
      default: false,
      defaultPlayerCount: 7,
      rolesByCount: Object.freeze({
        5: ["merlin", "assassin", "minion", "loyal", "loyal"],
        6: ["merlin", "percival", "assassin", "morgana", "loyal", "loyal"],
        7: ["merlin", "percival", "assassin", "morgana", "loyal", "loyal", "loyal"],
        8: ["merlin", "percival", "assassin", "morgana", "minion", "loyal", "loyal", "loyal"],
        9: [
          "merlin",
          "percival",
          "assassin",
          "morgana",
          "minion",
          "loyal",
          "loyal",
          "loyal",
          "loyal"
        ],
        10: [
          "merlin",
          "percival",
          "assassin",
          "morgana",
          "minion",
          "minion",
          "loyal",
          "loyal",
          "loyal",
          "loyal"
        ]
      })
    })
  })
});
const CAPABILITY_MANAGED_GAME_KEYS = Object.freeze(
  Object.values(GAME_CATALOG)
    .filter((entry) => entry.isShipped && entry.capabilityManaged !== false)
    .sort((left, right) => left.hubOrder - right.hubOrder)
    .map((entry) => entry.key)
);
const SHIPPED_GAME_KEYS = Object.freeze(
  Object.values(GAME_CATALOG)
    .filter((entry) => entry.isShipped)
    .sort((left, right) => left.hubOrder - right.hubOrder)
    .map((entry) => entry.key)
);
const UPCOMING_GAME_KEYS = Object.freeze(
  Object.values(GAME_CATALOG)
    .filter((entry) => entry.launchState === "coming-soon")
    .sort((left, right) => left.hubOrder - right.hubOrder)
    .map((entry) => entry.key)
);

function getGameMeta(gameKey) {
  return GAME_CATALOG[gameKey] || null;
}

function getFamilyMeta(familyKey) {
  return GAME_FAMILY_CATALOG[familyKey] || null;
}

function getGameMode(gameKey) {
  return getGameMeta(gameKey)?.familyKey || null;
}

function getGameSharePath(gameKey, roomNo = "{roomNo}") {
  if (!GAME_CATALOG[gameKey]?.supportsShareLink) {
    return "";
  }

  return `/entry/${gameKey}/${roomNo}`;
}

function listCatalogGames({ includeUpcoming = true } = {}) {
  return Object.values(GAME_CATALOG)
    .filter((entry) => includeUpcoming || entry.launchState !== "coming-soon")
    .sort((left, right) => {
      const familyOrder =
        (getFamilyMeta(left.familyKey)?.hubOrder || 999) - (getFamilyMeta(right.familyKey)?.hubOrder || 999);
      if (familyOrder !== 0) {
        return familyOrder;
      }

      return left.hubOrder - right.hubOrder;
    });
}

function listCatalogFamilies() {
  return Object.values(GAME_FAMILY_CATALOG).sort((left, right) => left.hubOrder - right.hubOrder);
}

function getPartyDefaultConfig(gameKey) {
  if (gameKey === "werewolf") {
    return {
      visibility: "public",
      maxPlayers: 8,
      rolePack: getPartyRolePack(gameKey)?.key || "standard",
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
      rolePack: getPartyRolePack(gameKey)?.key || "advanced",
      teamBuildSeconds: 45,
      voteSeconds: 30,
      questSeconds: 25,
      assassinSeconds: 30,
      voiceEnabled: true
    };
  }

  if (gameKey === "undercover") {
    return {
      visibility: "public",
      maxPlayers: 6,
      discussionSeconds: 45,
      voteSeconds: 30,
      voiceEnabled: true
    };
  }

  if (gameKey === "drawguess") {
    return {
      visibility: "public",
      maxPlayers: 6,
      roundSeconds: 75,
      revealSeconds: 12,
      maxRounds: 6,
      voiceEnabled: true
    };
  }

  return {};
}

function getRacingDefaultConfig() {
  return {
    visibility: "public",
    maxPlayers: 4,
    lapCount: 3
  };
}

function getBoardDefaultConfig(gameKey) {
  if (gameKey === "gomoku") {
    return {
      visibility: "public",
      maxPlayers: 2,
      turnSeconds: 25,
      openingRule: "standard"
    };
  }

  if (gameKey === "chinesecheckers") {
    return {
      visibility: "public",
      maxPlayers: 2,
      turnSeconds: 30
    };
  }

  if (gameKey === "reversi") {
    return {
      visibility: "public",
      maxPlayers: 2,
      turnSeconds: 20
    };
  }

  if (gameKey === "flyingchess") {
    return {
      visibility: "public",
      maxPlayers: 4,
      turnSeconds: 20
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

  if (gameKey === "undercover") {
    return { minPlayers: 4, maxPlayers: 10 };
  }

  if (gameKey === "drawguess") {
    return { minPlayers: 3, maxPlayers: 10 };
  }

  if (gameKey === "chinesecheckers") {
    return { minPlayers: 2, maxPlayers: 6 };
  }

  if (gameKey === "flyingchess") {
    return { minPlayers: 2, maxPlayers: 4 };
  }

  if (gameKey === "gomoku" || gameKey === "reversi" || gameKey === "pickred") {
    return { minPlayers: 2, maxPlayers: 2 };
  }

  if (gameKey === "bigtwo" || gameKey === "mahjong") {
    return { minPlayers: 4, maxPlayers: 4 };
  }

  if (gameKey === "sokoban") {
    return { minPlayers: 1, maxPlayers: 1 };
  }

  if (gameKey === "racing") {
    return { minPlayers: 2, maxPlayers: 4 };
  }

  return { minPlayers: 0, maxPlayers: 0 };
}

function getBoardPlayerOptions(gameKey) {
  if (gameKey === "chinesecheckers") {
    return [2, 4, 6];
  }

  if (gameKey === "gomoku" || gameKey === "reversi") {
    return [2];
  }

  if (gameKey === "flyingchess") {
    return [2, 3, 4];
  }

  return [];
}

function getBoardOpeningOptions(gameKey) {
  return BOARD_OPENING_RULES[gameKey] || [];
}

function getBoardConfigSummary(gameKey, config = {}) {
  if (gameKey === "gomoku") {
    const openingRules = getBoardOpeningOptions(gameKey);
    const openingRule =
      openingRules.find((option) => option.key === config.openingRule) || openingRules[0];

    return [
      openingRule?.label || "标准开局",
      `${Number(config.turnSeconds || 25)} 秒/手`
    ].filter(Boolean);
  }

  if (gameKey === "chinesecheckers") {
    return [
      `${Number(config.maxPlayers || 2)} 人满桌开局`,
      `${Number(config.turnSeconds || 30)} 秒/手`
    ];
  }

  if (gameKey === "reversi") {
    return [`${Number(config.turnSeconds || 20)} 秒/手`];
  }

  if (gameKey === "flyingchess") {
    return [
      `${Number(config.maxPlayers || 4)} 人满桌开局`,
      `${Number(config.turnSeconds || 20)} 秒/手`,
      "经典飞行规则"
    ];
  }

  return [];
}

function getPartyRolePackOptions(gameKey) {
  return Object.values(PARTY_ROLE_PACKS[gameKey] || {}).map((pack) => ({
    key: pack.key,
    label: pack.label,
    description: pack.description,
    default: Boolean(pack.default)
  }));
}

function getPartyRolePack(gameKey, rolePack) {
  const packs = PARTY_ROLE_PACKS[gameKey] || {};
  const options = Object.values(packs);
  if (options.length === 0) {
    return null;
  }

  const defaultPack = options.find((pack) => pack.default) || options[0];
  return packs[rolePack] || defaultPack;
}

function getPartyRolesForPack(gameKey, playerCount, rolePack) {
  const pack = getPartyRolePack(gameKey, rolePack);
  if (!pack) {
    return [];
  }

  const roles =
    pack.rolesByCount[playerCount] ||
    pack.rolesByCount[pack.defaultPlayerCount] ||
    pack.rolesByCount[Number(Object.keys(pack.rolesByCount)[0])] ||
    [];

  return [...roles];
}

function getPartyRolePackSummary(gameKey, playerCount, rolePack) {
  const pack = getPartyRolePack(gameKey, rolePack);
  if (!pack) {
    return {
      key: null,
      label: "",
      description: "",
      roles: []
    };
  }

  const counts = new Map();
  for (const role of getPartyRolesForPack(gameKey, playerCount, rolePack)) {
    counts.set(role, (counts.get(role) || 0) + 1);
  }

  return {
    key: pack.key,
    label: pack.label,
    description: pack.description,
    roles: [...counts.entries()].map(([role, count]) => ({
      key: role,
      count,
      label: PARTY_ROLE_LABELS[gameKey]?.[role] || role
    }))
  };
}

module.exports = {
  GAME_CATALOG,
  GAME_FAMILY_CATALOG,
  PARTY_GAME_KEYS,
  BOARD_GAME_KEYS,
  PARTY_ROLE_PACKS,
  CAPABILITY_MANAGED_GAME_KEYS,
  SHIPPED_GAME_KEYS,
  UPCOMING_GAME_KEYS,
  getGameMeta,
  getFamilyMeta,
  getGameMode,
  getGameSharePath,
  listCatalogGames,
  listCatalogFamilies,
  getPartyDefaultConfig,
  getPartyRolePackOptions,
  getPartyRolePack,
  getPartyRolesForPack,
  getPartyRolePackSummary,
  getBoardDefaultConfig,
  getBoardOpeningOptions,
  getBoardConfigSummary,
  getRacingDefaultConfig,
  getGameLimits,
  getBoardPlayerOptions
};
