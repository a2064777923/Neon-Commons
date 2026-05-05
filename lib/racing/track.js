"use strict";

const TRACK_WIDTH = 12;
const TRACK_LENGTH = 200;

// Oval track centered at origin.
// Straight sections along Z axis, semicircular curves at +/- Z extremes.
// Track runs clockwise when viewed from above.
const STRAIGHT_HALF = 40; // half-length of each straight
const CURVE_RADIUS = 30;

const TRACK_DEFINITION = Object.freeze({
  walls: Object.freeze(generateOvalWalls(STRAIGHT_HALF, CURVE_RADIUS, TRACK_WIDTH)),
  startLine: Object.freeze({ x: 0, z: -STRAIGHT_HALF, direction: 1 }),
  spawnPoints: Object.freeze([
    Object.freeze({ x: -3, z: -STRAIGHT_HALF - 5 }),
    Object.freeze({ x: 0, z: -STRAIGHT_HALF - 8 }),
    Object.freeze({ x: 3, z: -STRAIGHT_HALF - 5 }),
    Object.freeze({ x: 0, z: -STRAIGHT_HALF - 11 })
  ]),
  lapTriggerPosition: Object.freeze({ x: 0, z: -STRAIGHT_HALF })
});

function generateOvalWalls(straightHalf, curveRadius, trackWidth) {
  const walls = [];
  const halfTrack = trackWidth / 2;
  const wallHeight = 1;

  // Inner straight walls (along z, on inner edge x = -halfTrack)
  walls.push(
    { x: -halfTrack, y: wallHeight, z: -straightHalf / 2, halfWidth: 0.5, halfHeight: wallHeight, halfDepth: straightHalf / 2 },
    { x: halfTrack, y: wallHeight, z: -straightHalf / 2, halfWidth: 0.5, halfHeight: wallHeight, halfDepth: straightHalf / 2 }
  );

  // Outer straight walls (along z, on outer edge x = +halfTrack)
  walls.push(
    { x: -halfTrack, y: wallHeight, z: straightHalf / 2, halfWidth: 0.5, halfHeight: wallHeight, halfDepth: straightHalf / 2 },
    { x: halfTrack, y: wallHeight, z: straightHalf / 2, halfWidth: 0.5, halfHeight: wallHeight, halfDepth: straightHalf / 2 }
  );

  // Curve walls: approximate semicircles with segments
  const segments = 8;

  // Top curve (z = -straightHalf, centered at (0, 0, -straightHalf))
  for (let i = 0; i < segments; i++) {
    const angle1 = Math.PI + (Math.PI * i) / segments;
    const angle2 = Math.PI + (Math.PI * (i + 1)) / segments;
    const midAngle = (angle1 + angle2) / 2;

    // Inner wall
    const innerR = curveRadius - halfTrack;
    walls.push({
      x: Math.cos(midAngle) * innerR,
      y: wallHeight,
      z: -straightHalf + Math.sin(midAngle) * innerR,
      halfWidth: 0.5,
      halfHeight: wallHeight,
      halfDepth: (Math.PI * innerR) / segments / 2
    });

    // Outer wall
    const outerR = curveRadius + halfTrack;
    walls.push({
      x: Math.cos(midAngle) * outerR,
      y: wallHeight,
      z: -straightHalf + Math.sin(midAngle) * outerR,
      halfWidth: 0.5,
      halfHeight: wallHeight,
      halfDepth: (Math.PI * outerR) / segments / 2
    });
  }

  // Bottom curve (z = +straightHalf, centered at (0, 0, +straightHalf))
  for (let i = 0; i < segments; i++) {
    const angle1 = (Math.PI * i) / segments;
    const angle2 = (Math.PI * (i + 1)) / segments;
    const midAngle = (angle1 + angle2) / 2;

    // Inner wall
    const innerR = curveRadius - halfTrack;
    walls.push({
      x: Math.cos(midAngle) * innerR,
      y: wallHeight,
      z: straightHalf + Math.sin(midAngle) * innerR,
      halfWidth: 0.5,
      halfHeight: wallHeight,
      halfDepth: (Math.PI * innerR) / segments / 2
    });

    // Outer wall
    const outerR = curveRadius + halfTrack;
    walls.push({
      x: Math.cos(midAngle) * outerR,
      y: wallHeight,
      z: straightHalf + Math.sin(midAngle) * outerR,
      halfWidth: 0.5,
      halfHeight: wallHeight,
      halfDepth: (Math.PI * outerR) / segments / 2
    });
  }

  return walls;
}

module.exports = {
  TRACK_DEFINITION,
  TRACK_WIDTH,
  TRACK_LENGTH
};
