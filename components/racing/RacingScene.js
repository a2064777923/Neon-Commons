"use client";

import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import CarModel from "./CarModel";
import TrackModel from "./TrackModel";

export default function RacingScene({ gameState, mySeatIndex, canvasRef }) {
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const carGroupRef = useRef(null);
  const trackGroupRef = useRef(null);
  const frameRef = useRef(null);
  const cameraTargetRef = useRef(new THREE.Vector3(0, 5, -15));
  const cameraLookRef = useRef(new THREE.Vector3(0, 0, 0));

  const maxPlayers = gameState?.cars?.length || 4;

  // Initialize Three.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    scene.fog = new THREE.Fog(0x0a0e1a, 100, 300);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 15, -25);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Lights
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 40, -20);
    scene.add(dirLight);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambLight);

    // Car group
    const carGroup = new THREE.Group();
    scene.add(carGroup);
    carGroupRef.current = carGroup;

    // Track group
    const trackGroup = new THREE.Group();
    scene.add(trackGroup);
    trackGroupRef.current = trackGroup;

    // Animation loop
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    function onResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
    };
  }, [canvasRef]);

  // Update car positions from game state
  useEffect(() => {
    const carGroup = carGroupRef.current;
    if (!carGroup || !gameState?.cars) return;

    // Ensure we have enough car groups
    while (carGroup.children.length < gameState.cars.length) {
      const idx = carGroup.children.length;
      const carGroupItem = new THREE.Group();
      // Create a simple car mesh inline since we can't use JSX in useEffect
      const color = [0xef4444, 0x3b82f6, 0x22c55e, 0xeab308][idx % 4];
      const bodyMat = new THREE.MeshLambertMaterial({ color });
      const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
      const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

      const bodyGeo = new THREE.BoxGeometry(2, 1, 4);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.5;
      carGroupItem.add(body);

      const cabinGeo = new THREE.BoxGeometry(1.6, 0.8, 2);
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 1.3, -0.3);
      carGroupItem.add(cabin);

      const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
      [[-1.1, 0.4, 1.2], [1.1, 0.4, 1.2], [-1.1, 0.4, -1.2], [1.1, 0.4, -1.2]].forEach(
        ([x, y, z]) => {
          const wheel = new THREE.Mesh(wheelGeo, wheelMat);
          wheel.position.set(x, y, z);
          wheel.rotation.z = Math.PI / 2;
          carGroupItem.add(wheel);
        }
      );

      carGroup.add(carGroupItem);
    }

    // Update positions
    gameState.cars.forEach((car, index) => {
      if (index >= carGroup.children.length) return;
      const carObj = carGroup.children[index];

      if (car.pos) {
        // Lerp to target position
        carObj.position.lerp(
          new THREE.Vector3(car.pos.x, car.pos.y, car.pos.z),
          0.3
        );
      }

      if (car.rot) {
        // Slerp to target rotation
        const targetQuat = new THREE.Quaternion(
          car.rot.x,
          car.rot.y,
          car.rot.z,
          car.rot.w
        );
        carObj.quaternion.slerp(targetQuat, 0.3);
      }
    });

    // Camera follow: chase behind player's car
    if (mySeatIndex != null && mySeatIndex < gameState.cars.length) {
      const myCar = gameState.cars[mySeatIndex];
      if (myCar?.pos) {
        const carPos = new THREE.Vector3(myCar.pos.x, myCar.pos.y, myCar.pos.z);

        // Get car's forward direction from quaternion
        const forward = new THREE.Vector3(0, 0, 1);
        if (myCar.rot) {
          const quat = new THREE.Quaternion(myCar.rot.x, myCar.rot.y, myCar.rot.z, myCar.rot.w);
          forward.applyQuaternion(quat);
        }

        // Camera position: behind and above the car
        const cameraOffset = forward.clone().multiplyScalar(-12);
        cameraOffset.y = 8;
        const targetCameraPos = carPos.clone().add(cameraOffset);

        // Smooth follow
        cameraTargetRef.current.lerp(targetCameraPos, 0.08);
        cameraLookRef.current.lerp(carPos, 0.12);

        const camera = cameraRef.current;
        if (camera) {
          camera.position.copy(cameraTargetRef.current);
          camera.lookAt(cameraLookRef.current);
        }
      }
    }
  }, [gameState, mySeatIndex]);

  return null;
}
