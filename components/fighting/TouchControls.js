"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "../../styles/FightingRoom.module.css";

export default function TouchControls({ onInput }) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const joystickRef = useRef(null);
  const knobRef = useRef(null);
  const touchIdRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const inputRef = useRef({
    left: false, right: false, up: false,
    attack: false, heavy: false, block: false, dodge: false,
  });
  const pressedRef = useRef({});

  useEffect(() => {
    setIsTouchDevice(
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0)
    );
  }, []);

  // Joystick handling
  useEffect(() => {
    if (!isTouchDevice) return;

    function handleTouchStart(e) {
      const touch = e.changedTouches[0];
      touchIdRef.current = touch.identifier;
      startRef.current = { x: touch.clientX, y: touch.clientY };
    }

    function handleTouchMove(e) {
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchIdRef.current) {
          const dx = touch.clientX - startRef.current.x;
          const dy = touch.clientY - startRef.current.y;

          inputRef.current = {
            ...inputRef.current,
            left: dx < -20,
            right: dx > 20,
            up: dy < -30,
          };
          onInput({ ...inputRef.current });

          if (knobRef.current) {
            const clampedDx = Math.max(-40, Math.min(40, dx * 0.5));
            const clampedDy = Math.max(-40, Math.min(40, dy * 0.5));
            knobRef.current.style.transform = `translate(calc(-50% + ${clampedDx}px), calc(-50% + ${clampedDy}px))`;
          }
        }
      }
    }

    function handleTouchEnd(e) {
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchIdRef.current) {
          touchIdRef.current = null;
          inputRef.current = {
            ...inputRef.current,
            left: false,
            right: false,
            up: false,
          };
          onInput({ ...inputRef.current });

          if (knobRef.current) {
            knobRef.current.style.transform = "translate(-50%, -50%)";
          }
        }
      }
    }

    const el = joystickRef.current;
    if (el) {
      el.addEventListener("touchstart", handleTouchStart, { passive: true });
      el.addEventListener("touchmove", handleTouchMove, { passive: true });
      el.addEventListener("touchend", handleTouchEnd, { passive: true });
      el.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    }

    return () => {
      if (el) {
        el.removeEventListener("touchstart", handleTouchStart);
        el.removeEventListener("touchmove", handleTouchMove);
        el.removeEventListener("touchend", handleTouchEnd);
        el.removeEventListener("touchcancel", handleTouchEnd);
      }
    };
  }, [isTouchDevice, onInput]);

  // Action button handlers
  const makeStart = useCallback((key) => () => {
    inputRef.current = { ...inputRef.current, [key]: true };
    pressedRef.current[key] = true;
    onInput({ ...inputRef.current });
  }, [onInput]);

  const makeEnd = useCallback((key) => () => {
    inputRef.current = { ...inputRef.current, [key]: false };
    pressedRef.current[key] = false;
    onInput({ ...inputRef.current });
  }, [onInput]);

  if (!isTouchDevice) return null;

  return (
    <div className={styles.touchControls}>
      <div className={styles.joystick} ref={joystickRef}>
        <div className={styles.joystickKnob} ref={knobRef} />
      </div>
      <div className={styles.actionButtons}>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.jumpBtn} ${pressedRef.current.up ? styles.pressed : ""}`}
          onTouchStart={makeStart("up")}
          onTouchEnd={makeEnd("up")}
          onTouchCancel={makeEnd("up")}
        >
          U
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.heavyBtn} ${pressedRef.current.heavy ? styles.pressed : ""}`}
          onTouchStart={makeStart("heavy")}
          onTouchEnd={makeEnd("heavy")}
          onTouchCancel={makeEnd("heavy")}
        >
          H
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.dodgeBtn} ${pressedRef.current.dodge ? styles.pressed : ""}`}
          onTouchStart={makeStart("dodge")}
          onTouchEnd={makeEnd("dodge")}
          onTouchCancel={makeEnd("dodge")}
        >
          D
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.attackBtn} ${pressedRef.current.attack ? styles.pressed : ""}`}
          onTouchStart={makeStart("attack")}
          onTouchEnd={makeEnd("attack")}
          onTouchCancel={makeEnd("attack")}
        >
          A
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.blockBtn} ${pressedRef.current.block ? styles.pressed : ""}`}
          onTouchStart={makeStart("block")}
          onTouchEnd={makeEnd("block")}
          onTouchCancel={makeEnd("block")}
        >
          B
        </button>
      </div>
    </div>
  );
}
