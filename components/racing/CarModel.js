"use client";

import { useRef, useEffect } from "react";
import * as THREE from "three";

const CAR_COLORS = [0xef4444, 0x3b82f6, 0x22c55e, 0xeab308];

export default function CarModel({ seatIndex = 0 }) {
  const groupRef = useRef(null);
  const color = CAR_COLORS[seatIndex % CAR_COLORS.length];

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Clear previous children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

    // Body
    const bodyGeo = new THREE.BoxGeometry(2, 1, 4);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    group.add(body);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.8, 2);
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.3, -0.3);
    group.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
    const wheelPositions = [
      [-1.1, 0.4, 1.2],
      [1.1, 0.4, 1.2],
      [-1.1, 0.4, -1.2],
      [1.1, 0.4, -1.2]
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, y, z);
      wheel.rotation.z = Math.PI / 2;
      group.add(wheel);
    });

    return () => {
      bodyGeo.dispose();
      cabinGeo.dispose();
      wheelGeo.dispose();
      bodyMat.dispose();
      cabinMat.dispose();
      wheelMat.dispose();
    };
  }, [color]);

  return <group ref={groupRef} />;
}
