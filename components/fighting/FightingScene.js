"use client";

import { useRef, useEffect, useState, useCallback } from "react";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function FightingScene({ gameState, arena, myIndex }) {
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const [pixiApp, setPixiApp] = useState(null);

  // Initialize PixiJS application
  useEffect(() => {
    let app;
    let destroyed = false;

    async function init() {
      if (!canvasRef.current) return;

      try {
        const PIXI = await import("pixi.js");
        app = new PIXI.Application();

        await app.init({
          canvas: canvasRef.current,
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          backgroundColor: 0x1a1a2e,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        });

        if (destroyed) {
          app.destroy(true);
          return;
        }

        appRef.current = app;
        setPixiApp(app);
      } catch (err) {
        console.error("Failed to init PixiJS:", err);
      }
    }

    init();

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  // Render arena platforms
  useEffect(() => {
    if (!pixiApp?.stage || !arena?.platforms) return;

    const { Graphics } = pixiApp.stage.constructor ? require("pixi.js") : { Graphics: null };

    // Clear stage
    while (pixiApp.stage.children.length > 0) {
      pixiApp.stage.removeChildAt(0);
    }

    // Background
    const bg = new (require("pixi.js").Graphics)();
    bg.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    bg.fill(0x1a1a2e);
    pixiApp.stage.addChild(bg);

    // Platforms
    const platGfx = new (require("pixi.js").Graphics)();
    for (const plat of arena.platforms) {
      const isGround = plat.y >= (arena.height || CANVAS_HEIGHT) - 10;
      platGfx.roundRect(plat.x, plat.y, plat.w, plat.h, 3);
      platGfx.fill(isGround ? 0x2a2a3e : 0x3a3a5e);
      platGfx.roundRect(plat.x, plat.y, plat.w, plat.h, 3);
      platGfx.stroke({ width: 1, color: isGround ? 0x3a3a5e : 0x4a4a7e, alpha: 0.5 });
    }
    pixiApp.stage.addChild(platGfx);
  }, [arena, pixiApp]);

  // Render characters
  useEffect(() => {
    if (!pixiApp?.stage || !gameState?.characters) return;

    const { Graphics } = require("pixi.js");
    const stage = pixiApp.stage;

    // Remove old character containers (keep bg + platforms at indices 0,1)
    while (stage.children.length > 2) {
      stage.removeChildAt(stage.children.length - 1);
    }

    const colors = [0x4488ff, 0xff4444, 0x44cc44, 0xffaa00];

    for (const char of gameState.characters) {
      const g = new Graphics();
      const cx = (char.pos?.x || 0) + CANVAS_WIDTH / 2;
      const cy = (char.pos?.y || 0) + CANVAS_HEIGHT / 2;
      const color = colors[char.seatIndex % colors.length];
      const facingRight = char.facing === "right";
      const alpha = char.invulnerable ? 0.4 : 1;

      g.position.set(cx, cy);
      g.alpha = alpha;

      // Body
      g.roundRect(-15, -80, 30, 80, 4);
      g.fill({ color, alpha: 0.9 });
      g.roundRect(-15, -80, 30, 80, 4);
      g.stroke({ width: 1, color: 0xffffff, alpha: 0.2 });

      // Head
      g.circle(0, -90, 12);
      g.fill({ color, alpha: 0.9 });

      // Eye
      g.circle(facingRight ? 4 : -4, -92, 2);
      g.fill(0xffffff);

      // State-specific visuals
      const isAttacking = char.state === "attack_light" || char.state === "attack_heavy" ||
        char.state === "special" || char.state === "finisher";
      const isBlocking = char.state === "block" || char.state === "parry";
      const isKO = char.state === "ko" || char.state === "ring_out";

      if (isAttacking) {
        const ext = char.state === "attack_heavy" ? 20 : 12;
        g.roundRect(15, -50, ext, 8, 4);
        g.fill({ color: 0xff8844, alpha: 0.8 });
      }

      if (isBlocking) {
        g.roundRect(-25, -60, 10, 30, 3);
        g.fill({ color: 0x6688ff, alpha: 0.6 });
      }

      if (isKO) {
        g.circle(-8, -108, 3);
        g.fill(0xffdd57);
        g.circle(8, -112, 3);
        g.fill(0xffdd57);
      }

      if (char.state === "hit_stun") {
        g.tint = 0xff6666;
      }

      // Player indicator
      g.roundRect(-12, -115, 24, 12, 3);
      g.fill({ color: 0x000000, alpha: 0.5 });

      stage.addChild(g);
    }
  }, [gameState, pixiApp]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}
