const { getPartyRoomManager } = require("../party/manager");
const {
  AVAILABILITY_STATES,
  buildAvailabilityControlList,
  getAvailabilityStateLabel
} = require("../shared/availability");
const { VOICE_TRANSPORT_MODES } = require("../shared/network-contract");
const { listLiveRooms } = require("./live-room-ops");

const STATE_ORDER = Object.freeze({
  [AVAILABILITY_STATES.HEALTHY]: 0,
  [AVAILABILITY_STATES.DEGRADED]: 1,
  [AVAILABILITY_STATES.BLOCKED]: 2
});

function buildAdminHealthSnapshot({ availabilityControls, rolloutSummary }) {
  const liveRooms = listLiveRooms();
  const overview = buildOverview(liveRooms);
  const availabilityRows = buildAvailabilityControlList(availabilityControls);

  const cards = [
    buildEntryCard(availabilityRows, liveRooms),
    buildRealtimeCard(availabilityRows, overview),
    buildVoiceCard(availabilityRows),
    buildRolloutCard(rolloutSummary)
  ];

  return {
    generatedAt: new Date().toISOString(),
    overallState: determineOverallState(cards.filter((card) => card.key !== "rollout")),
    overview,
    cards
  };
}

function buildOverview(liveRooms) {
  return liveRooms.reduce(
    (summary, room) => {
      if (room.availability === "draining") {
        summary.drainingRooms += 1;
      } else if (room.availability === "snapshot-only") {
        summary.snapshotOnlyRooms += 1;
      } else if (room.availability === "closed") {
        summary.closedRooms += 1;
      } else {
        summary.liveRooms += 1;
      }

      summary.totalHumans += Number(room.occupancy?.humans || 0);
      summary.totalPlayers += Number(room.occupancy?.total || 0);
      summary.connectedHumans += Number(room.occupancy?.connectedHumans || 0);
      return summary;
    },
    {
      liveRooms: 0,
      drainingRooms: 0,
      snapshotOnlyRooms: 0,
      closedRooms: 0,
      totalHumans: 0,
      totalPlayers: 0,
      connectedHumans: 0
    }
  );
}

function buildEntryCard(rows, liveRooms) {
  const card = buildAvailabilitySubsystemCard({
    rows,
    subsystem: "entry",
    label: "房號與入口",
    healthyMessage: "房號加入、邀請連結與 guest 入口維持正常。",
    fallbackScopeLabel: "全域入口"
  });

  const affectedFamilies = getAffectedFamilies(rows, "entry");
  const impactedRooms =
    affectedFamilies.size === 0
      ? liveRooms.length
      : liveRooms.filter((room) => affectedFamilies.has(room.familyKey)).length;

  return {
    ...card,
    metrics: [
      { label: "受影響範圍", value: affectedFamilies.size || (card.state === "healthy" ? 0 : 1) },
      { label: "對應房間", value: impactedRooms },
      { label: "安全操作", value: card.safeActions.length }
    ]
  };
}

function buildRealtimeCard(rows, overview) {
  const controlCard = buildAvailabilitySubsystemCard({
    rows,
    subsystem: "realtime",
    label: "即時房況",
    healthyMessage: "目前沒有全域或家族級 realtime 降級控制。"
  });

  const nonLiveRooms = overview.drainingRooms + overview.snapshotOnlyRooms;
  const runtimeCard =
    nonLiveRooms > 0
      ? {
          state: AVAILABILITY_STATES.DEGRADED,
          stateLabel: getAvailabilityStateLabel(AVAILABILITY_STATES.DEGRADED),
          message: `目前有 ${nonLiveRooms} 間房不在完整 live 狀態。`,
          scopeLabel: "Live 房目錄",
          safeActions: [],
          lastTransitionAt: null
        }
      : null;

  const card = pickWorseCard(
    {
      ...controlCard,
      key: "realtime"
    },
    runtimeCard ? { ...runtimeCard, key: "realtime", label: "即時房況", metrics: [] } : null
  ) || {
    ...controlCard,
    key: "realtime"
  };

  return {
    ...card,
    label: "即時房況",
    metrics: [
      { label: "Live 房", value: overview.liveRooms },
      { label: "排空/快照", value: nonLiveRooms },
      { label: "連線中真人", value: overview.connectedHumans }
    ]
  };
}

function buildVoiceCard(rows) {
  const controlCard = buildAvailabilitySubsystemCard({
    rows,
    subsystem: "voice",
    label: "派對語音",
    healthyMessage: "派對語音維持健康，未觀察到 relay 或 recovery 壓力。"
  });

  const partyRooms = getPartyRoomManager().listRooms();
  const runtimeImpactedRooms = partyRooms.filter((room) => {
    const runtimeState = String(room.runtimeVoiceState?.state || "").trim();
    if (runtimeState === AVAILABILITY_STATES.BLOCKED || runtimeState === AVAILABILITY_STATES.DEGRADED) {
      return true;
    }

    return room.voiceTransport?.mode === VOICE_TRANSPORT_MODES.relayRequired;
  });

  const impactedPlayers = runtimeImpactedRooms.reduce(
    (sum, room) =>
      sum +
      room.players.filter((player) => !player.isBot).length,
    0
  );
  const lastTransitionAt = runtimeImpactedRooms
    .map((room) => room.voiceTransport?.lastTransitionAt || room.lastVoiceRecoveredAt || null)
    .filter(Boolean)
    .sort((left, right) => String(right).localeCompare(String(left)))[0] || null;
  const runtimeCard =
    runtimeImpactedRooms.length > 0
      ? {
          key: "voice",
          label: "派對語音",
          state: AVAILABILITY_STATES.DEGRADED,
          stateLabel: getAvailabilityStateLabel(AVAILABILITY_STATES.DEGRADED),
          message: `目前有 ${runtimeImpactedRooms.length} 間派對房進入 relay / recovery 語音模式。`,
          scopeLabel: "派對 live 房",
          safeActions: [],
          lastTransitionAt
        }
      : null;

  const card = pickWorseCard(
    {
      ...controlCard,
      key: "voice"
    },
    runtimeCard
  ) || {
    ...controlCard,
    key: "voice"
  };

  return {
    ...card,
    label: "派對語音",
    metrics: [
      { label: "派對房", value: partyRooms.length },
      { label: "relay/降級", value: runtimeImpactedRooms.length },
      { label: "受影響真人", value: impactedPlayers }
    ]
  };
}

function buildRolloutCard(rolloutSummary = {}) {
  const counts = rolloutSummary.counts || {};
  const overriddenTitles = Number(rolloutSummary.overriddenTitles || 0);
  const managedTitles = Number(rolloutSummary.managedTitles || 0);
  const state =
    overriddenTitles > 0 ? AVAILABILITY_STATES.DEGRADED : AVAILABILITY_STATES.HEALTHY;

  return {
    key: "rollout",
    label: "第二波 rollout",
    state,
    stateLabel: getAvailabilityStateLabel(state),
    message:
      overriddenTitles > 0
        ? `${overriddenTitles} 個標題使用後台 rollout 覆寫。`
        : "目前採用 catalog 預設 rollout 節奏。",
    scopeLabel: "按標題控制",
    safeActions: [],
    lastTransitionAt: null,
    metrics: [
      { label: "Playable", value: Number(counts.playable || 0) },
      { label: "暫停新房", value: Number(counts["paused-new-rooms"] || 0) },
      { label: "即將推出", value: Number(counts["coming-soon"] || 0) },
      { label: "受控標題", value: managedTitles }
    ]
  };
}

function buildAvailabilitySubsystemCard({ rows, subsystem, label, healthyMessage, fallbackScopeLabel = "全域" }) {
  const subsystemRows = rows.filter((row) => row.subsystem === subsystem);
  const worstRow = pickWorstAvailabilityRow(subsystemRows);

  if (!worstRow || worstRow.state === AVAILABILITY_STATES.HEALTHY) {
    return {
      key: subsystem,
      label,
      state: AVAILABILITY_STATES.HEALTHY,
      stateLabel: getAvailabilityStateLabel(AVAILABILITY_STATES.HEALTHY),
      message: healthyMessage,
      scopeLabel: fallbackScopeLabel,
      safeActions: [],
      lastTransitionAt: null
    };
  }

  return {
    key: subsystem,
    label,
    state: worstRow.state,
    stateLabel: worstRow.stateLabel,
    message: worstRow.message,
    scopeLabel: worstRow.scopeLabel,
    safeActions: [...(worstRow.safeActions || [])],
    lastTransitionAt: null
  };
}

function getAffectedFamilies(rows, subsystem) {
  return new Set(
    rows
      .filter((row) => row.subsystem === subsystem && row.state !== AVAILABILITY_STATES.HEALTHY)
      .map((row) => row.familyKey)
      .filter(Boolean)
  );
}

function pickWorstAvailabilityRow(rows = []) {
  let worst = null;
  for (const row of rows) {
    if (!worst) {
      worst = row;
      continue;
    }

    const currentOrder = Number(STATE_ORDER[row.state] ?? 0);
    const worstOrder = Number(STATE_ORDER[worst.state] ?? 0);
    if (currentOrder > worstOrder) {
      worst = row;
      continue;
    }

    if (currentOrder === worstOrder && row.scope === "global" && worst.scope !== "global") {
      worst = row;
    }
  }

  return worst;
}

function determineOverallState(cards = []) {
  return cards.reduce((state, card) => {
    if ((STATE_ORDER[card.state] ?? 0) > (STATE_ORDER[state] ?? 0)) {
      return card.state;
    }

    return state;
  }, AVAILABILITY_STATES.HEALTHY);
}

function pickWorseCard(left, right) {
  if (!left) {
    return right || null;
  }

  if (!right) {
    return left;
  }

  if ((STATE_ORDER[right.state] ?? 0) > (STATE_ORDER[left.state] ?? 0)) {
    return right;
  }

  return left;
}

module.exports = {
  buildAdminHealthSnapshot
};
