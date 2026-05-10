"use strict";

const BOARD_SIZE = 760;
const CENTER = BOARD_SIZE / 2;
const RING_RADIUS = 300;
const HOME_RADIUS = 140;
const AIRPORT_RADIUS = 100;
const RING_CELLS_COUNT = 52;

function getFlyingChessBoardGeometry(maxPlayers = 4) {
  const seatMarkers = [];
  const ringCells = [];
  const homeCells = [];
  const airportSlots = [];

  const seatAngles = maxPlayers === 2
    ? [Math.PI, 0]
    : maxPlayers === 3
      ? [Math.PI, Math.PI * 5 / 3, Math.PI / 3]
      : [Math.PI, Math.PI * 3 / 2, 0, Math.PI / 2];

  for (let i = 0; i < maxPlayers; i++) {
    const angle = seatAngles[i];
    seatMarkers.push({
      seatIndex: i,
      x: CENTER + Math.cos(angle) * (RING_RADIUS + 60),
      y: CENTER + Math.sin(angle) * (RING_RADIUS + 60)
    });

    for (let step = 0; step < 6; step++) {
      const t = (step + 1) / 7;
      homeCells.push({
        id: `home-${i}-${step}`,
        x: CENTER + Math.cos(angle) * HOME_RADIUS * (1 - t),
        y: CENTER + Math.sin(angle) * HOME_RADIUS * (1 - t)
      });
    }

    for (let slot = 0; slot < 4; slot++) {
      const slotAngle = angle + ((slot - 1.5) * 0.15);
      airportSlots.push({
        id: `airport-${i}-${slot}`,
        x: CENTER + Math.cos(slotAngle) * AIRPORT_RADIUS,
        y: CENTER + Math.sin(slotAngle) * AIRPORT_RADIUS
      });
    }
  }

  for (let i = 0; i < RING_CELLS_COUNT; i++) {
    const angle = (i / RING_CELLS_COUNT) * Math.PI * 2 - Math.PI / 2;
    ringCells.push({
      id: `ring-${i}`,
      x: CENTER + Math.cos(angle) * RING_RADIUS,
      y: CENTER + Math.sin(angle) * RING_RADIUS
    });
  }

  return { seatMarkers, ringCells, homeCells, airportSlots };
}

module.exports = { getFlyingChessBoardGeometry };
