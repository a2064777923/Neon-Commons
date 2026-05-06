"use client";

import { useRef, useEffect, useMemo } from "react";

const STATE_ANIM_SPEEDS = {
  idle: 0.167,
  walk: 0.167,
  jump: 0.2,
  fall: 0.2,
  attack_light: 0.3,
  attack_heavy: 0.15,
  special: 0.12,
  finisher: 0.1,
  block: 0.1,
  parry: 0.3,
  dodge: 0.25,
  hit_stun: 0.2,
  knockback: 0.15,
  ko: 0.1,
  ring_out: 0.1,
};

const CHAR_COLORS = [0x4488ff, 0xff4444, 0x44cc44, 0xffaa00];

export default function CharacterSprite({ character, canvasWidth, canvasHeight }) {
  const spriteRef = useRef(null);
  const hitTintRef = useRef(false);
  const prevStateRef = useRef(null);

  const { Graphics } = require("pixi.js");

  // Use fallback colored rectangles (sprite art not yet available)
  const color = CHAR_COLORS[character.seatIndex % CHAR_COLORS.length];

  useEffect(() => {
    return () => {
      if (spriteRef.current && spriteRef.current.parent) {
        spriteRef.current.parent.removeChild(spriteRef.current);
        spriteRef.current.destroy();
      }
    };
  }, []);

  // Determine visual based on state
  const isAttacking = character.state === "attack_light" || character.state === "attack_heavy" ||
    character.state === "special" || character.state === "finisher";
  const isBlocking = character.state === "block" || character.state === "parry";
  const isKO = character.state === "ko" || character.state === "ring_out";

  // Width/height for character body
  const bodyW = 30;
  const bodyH = 80;

  // Position: center origin
  const px = (character.pos?.x || 0) + (canvasWidth || 800) / 2;
  const py = (character.pos?.y || 0) + (canvasHeight || 600) / 2;

  // Facing direction
  const facingRight = character.facing === "right";
  const scaleX = facingRight ? 1 : -1;

  // Tint on hit_stun
  const tint = character.state === "hit_stun" ? 0xff6666 : 0xffffff;
  const alpha = character.invulnerable ? 0.4 : 1;

  // Animation wobble for walking
  const walkOffset = character.state === "walk"
    ? Math.sin((character.frameCount || 0) * 0.3) * 3
    : 0;

  // Attack arm extension
  const armExtend = isAttacking ? 15 : 0;

  return (
    <pixiContainer
      x={px}
      y={py}
      scale={{ x: scaleX, y: 1 }}
      alpha={alpha}
    >
      {/* Body */}
      <pixiGraphics
        draw={(g) => {
          g.clear();
          // Main body rectangle
          g.roundRect(-bodyW / 2, -bodyH, bodyW, bodyH, 4);
          g.fill({ color, alpha: 0.9 });
          // Outline
          g.roundRect(-bodyW / 2, -bodyH, bodyW, bodyH, 4);
          g.stroke({ width: 1, color: 0xffffff, alpha: 0.2 });

          // Head
          g.circle(0, -bodyH - 10, 12);
          g.fill({ color, alpha: 0.9 });

          // Eyes (simple dots)
          g.circle(4, -bodyH - 12, 2);
          g.fill(0xffffff);

          // Attack arm
          if (isAttacking) {
            g.roundRect(bodyW / 2, -bodyH * 0.6, armExtend + 10, 8, 4);
            g.fill({ color: 0xff8844, alpha: 0.8 });
          }

          // Block shield
          if (isBlocking) {
            g.roundRect(-bodyW / 2 - 8, -bodyH * 0.7, 10, 30, 3);
            g.fill({ color: 0x6688ff, alpha: 0.6 });
          }

          // KO stars
          if (isKO) {
            g.circle(-10, -bodyH - 25, 3);
            g.fill(0xffdd57);
            g.circle(10, -bodyH - 30, 3);
            g.fill(0xffdd57);
            g.circle(0, -bodyH - 35, 3);
            g.fill(0xffdd57);
          }
        }}
      />
    </pixiContainer>
  );
}
