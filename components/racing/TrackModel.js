"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function TrackModel({ trackDef }) {
  const groupRef = useRef(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group || !trackDef) return;

    // Clear previous children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x2d4a2d });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    group.add(ground);

    // Track surface (slightly lighter)
    const trackGeo = new THREE.PlaneGeometry(80, 160);
    const trackMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const trackSurface = new THREE.Mesh(trackGeo, trackMat);
    trackSurface.rotation.x = -Math.PI / 2;
    trackSurface.position.y = 0.01;
    group.add(trackSurface);

    // Walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const wallEmissive = new THREE.MeshLambertMaterial({
      color: 0x888888,
      emissive: 0x222222
    });

    trackDef.walls.forEach((wall, index) => {
      const geo = new THREE.BoxGeometry(
        wall.halfWidth * 2,
        wall.halfHeight * 2,
        wall.halfDepth * 2
      );
      const mat = index % 4 === 0 ? wallEmissive : wallMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(wall.x, wall.y, wall.z);
      group.add(mesh);
    });

    // Start/finish line
    const startLineGeo = new THREE.PlaneGeometry(12, 2);
    const startLineMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      emissive: 0x444444
    });
    const startLine = new THREE.Mesh(startLineGeo, startLineMat);
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(
      trackDef.startLine.x,
      0.02,
      trackDef.startLine.z
    );
    group.add(startLine);

    // Lane markings (dashed center line)
    const dashMat = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    for (let z = -40; z < 40; z += 6) {
      const dashGeo = new THREE.PlaneGeometry(0.3, 3);
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, z);
      group.add(dash);
    }

    return () => {
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      }
    };
  }, [trackDef]);

  return <group ref={groupRef} />;
}
