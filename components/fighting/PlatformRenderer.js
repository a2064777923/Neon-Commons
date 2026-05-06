"use client";

import { useRef, useEffect } from "react";

export default function PlatformRenderer({ arena, pixiApp }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!pixiApp?.stage || !arena?.platforms) return;

    const { Graphics } = require("pixi.js");
    const container = new Graphics();

    // Background gradient
    container.rect(0, 0, arena.width || 800, arena.height || 600);
    container.fill(0x1a1a2e);

    // Arena bounds
    container.rect(0, 0, arena.width || 800, arena.height || 600);
    container.stroke({ width: 2, color: 0x2a2a4e, alpha: 0.3 });

    // Render platforms
    for (const plat of arena.platforms) {
      const isGround = plat.y >= (arena.height || 600) - 10;
      const color = isGround ? 0x2a2a3e : 0x3a3a5e;
      const borderColor = isGround ? 0x3a3a5e : 0x4a4a7e;

      container.roundRect(plat.x, plat.y, plat.w, plat.h, 3);
      container.fill(color);
      container.roundRect(plat.x, plat.y, plat.w, plat.h, 3);
      container.stroke({ width: 1, color: borderColor, alpha: 0.5 });
    }

    pixiApp.stage.addChildAt(container, 0);
    containerRef.current = container;

    return () => {
      if (containerRef.current && containerRef.current.parent) {
        containerRef.current.parent.removeChild(containerRef.current);
        containerRef.current.destroy();
      }
    };
  }, [arena, pixiApp]);

  return null;
}
