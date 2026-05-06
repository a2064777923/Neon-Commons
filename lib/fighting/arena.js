"use strict";

const ARENA_LAYOUTS = Object.freeze({
  dojo: Object.freeze({
    bounds: Object.freeze({ left: -500, right: 500, top: -400, bottom: 600 }),
    platforms: Object.freeze([
      Object.freeze({ x: -350, y: 0, w: 700, h: 20 }),
      Object.freeze({ x: -350, y: -150, w: 200, h: 15 }),
      Object.freeze({ x: 150, y: -150, w: 200, h: 15 }),
      Object.freeze({ x: -75, y: -300, w: 150, h: 15 }),
    ]),
    spawnPoints: Object.freeze([
      Object.freeze({ x: -150, y: -50 }),
      Object.freeze({ x: 150, y: -50 }),
    ]),
  }),
});

/**
 * Returns the default arena layout.
 * @returns {object}
 */
function getDefaultArena() {
  return ARENA_LAYOUTS.dojo;
}

module.exports = {
  ARENA_LAYOUTS,
  getDefaultArena,
};
