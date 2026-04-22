const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getPartyDefaultConfig,
  getPartyRolePackSummary
} = require("../lib/games/catalog");
const { __testing } = require("../lib/party/manager");

test("werewolf and avalon defaults keep the shipped richer role packs", () => {
  const werewolfDefaults = getPartyDefaultConfig("werewolf");
  const avalonDefaults = getPartyDefaultConfig("avalon");

  assert.equal(werewolfDefaults.rolePack, "standard");
  assert.equal(werewolfDefaults.hunterSeconds, 20);
  assert.equal(werewolfDefaults.voiceEnabled, true);

  assert.equal(avalonDefaults.rolePack, "advanced");
  assert.equal(avalonDefaults.voiceEnabled, true);
});

test("normalizePartyConfig falls back to supported default role packs and clamps timers", () => {
  const werewolfConfig = __testing.normalizePartyConfig("werewolf", {
    maxPlayers: 20,
    rolePack: "unknown-pack",
    hunterSeconds: 200,
    voiceEnabled: false
  });

  assert.equal(werewolfConfig.maxPlayers, 10);
  assert.equal(werewolfConfig.rolePack, "standard");
  assert.equal(werewolfConfig.hunterSeconds, 45);
  assert.equal(werewolfConfig.voiceEnabled, false);

  const avalonConfig = __testing.normalizePartyConfig("avalon", {
    maxPlayers: 3,
    rolePack: "bad-pack",
    teamBuildSeconds: 5
  });

  assert.equal(avalonConfig.maxPlayers, 5);
  assert.equal(avalonConfig.rolePack, "advanced");
  assert.equal(avalonConfig.teamBuildSeconds, 20);
});

test("werewolf role distribution changes when switching to the casual pack", () => {
  const standardRoles = __testing.buildWerewolfRoles(8, "standard");
  const casualRoles = __testing.buildWerewolfRoles(8, "casual");

  assert.equal(standardRoles.includes("hunter"), true);
  assert.equal(casualRoles.includes("hunter"), false);
  assert.equal(standardRoles.filter((role) => role === "werewolf").length, 2);
  assert.equal(casualRoles.filter((role) => role === "werewolf").length, 2);
});

test("avalon role distribution changes between advanced and classic packs", () => {
  const advancedRoles = __testing.buildAvalonRoles(8, "advanced");
  const classicRoles = __testing.buildAvalonRoles(8, "classic");

  assert.equal(advancedRoles.includes("oberon"), true);
  assert.equal(classicRoles.includes("oberon"), false);
  assert.equal(classicRoles.includes("minion"), true);
  assert.equal(advancedRoles.includes("minion"), false);
});

test("role pack summary exposes enabled roles for room and lobby rendering", () => {
  const werewolfSummary = getPartyRolePackSummary("werewolf", 7, "standard");
  const avalonSummary = getPartyRolePackSummary("avalon", 8, "classic");

  assert.equal(werewolfSummary.label, "標準局");
  assert.deepEqual(
    werewolfSummary.roles.map((item) => `${item.label}x${item.count}`),
    ["狼人x2", "预言家x1", "女巫x1", "守卫x1", "猎人x1", "村民x1"]
  );

  assert.equal(avalonSummary.label, "經典局");
  assert.deepEqual(
    avalonSummary.roles.map((item) => `${item.label}x${item.count}`),
    ["梅林x1", "派西维尔x1", "刺客x1", "莫甘娜x1", "爪牙x1", "忠臣x3"]
  );
});
