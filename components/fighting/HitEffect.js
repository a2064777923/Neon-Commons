"use client";

import { useRef, useEffect, useState } from "react";

const EFFECT_COLORS = {
  spark: 0xffdd57,
  slash: 0xff6b6b,
  block_spark: 0x74b9ff,
};

const EFFECT_DURATION = 12; // frames

export default function HitEffect({ effects = [], pixiApp, canvasWidth, canvasHeight }) {
  const spritesRef = useRef([]);

  useEffect(() => {
    if (!pixiApp?.stage) return;

    const { Graphics } = require("pixi.js");

    // Clean up old sprites
    for (const sprite of spritesRef.current) {
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
      sprite.destroy();
    }
    spritesRef.current = [];

    // Render active effects
    for (const effect of effects) {
      if (effect.frame >= EFFECT_DURATION) continue;

      const color = EFFECT_COLORS[effect.type] || EFFECT_COLORS.spark;
      const alpha = 1 - effect.frame / EFFECT_DURATION;
      const size = 8 + effect.frame * 2;

      const g = new Graphics();
      const cx = (effect.x || 0) + (canvasWidth || 800) / 2;
      const cy = (effect.y || 0) + (canvasHeight || 600) / 2;

      // Spark effect
      g.circle(0, 0, size);
      g.fill({ color, alpha: alpha * 0.6 });

      // Outer ring
      g.circle(0, 0, size * 1.5);
      g.stroke({ width: 2, color, alpha: alpha * 0.3 });

      g.position.set(cx, cy);
      pixiApp.stage.addChild(g);
      spritesRef.current.push(g);
    }

    return () => {
      for (const sprite of spritesRef.current) {
        if (sprite.parent) {
          sprite.parent.removeChild(sprite);
        }
        sprite.destroy();
      }
      spritesRef.current = [];
    };
  }, [effects, pixiApp, canvasWidth, canvasHeight]);

  return null;
}
