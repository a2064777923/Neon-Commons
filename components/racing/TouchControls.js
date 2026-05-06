"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "../../styles/RacingRoom.module.css";

export default function TouchControls({ onInput }) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const joystickRef = useRef(null);
  const knobRef = useRef(null);
  const touchIdRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const inputRef = useRef({ accel: 0, brake: 0, steer: 0 });

  useEffect(() => {
    setIsTouchDevice(
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0)
    );
  }, []);

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
          const steer = Math.max(-1, Math.min(1, dx / 50));
          inputRef.current = { ...inputRef.current, steer };
          onInput(inputRef.current);

          if (knobRef.current) {
            knobRef.current.style.transform = `translate(calc(-50% + ${dx * 0.5}px), -50%)`;
          }
        }
      }
    }

    function handleTouchEnd(e) {
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchIdRef.current) {
          touchIdRef.current = null;
          inputRef.current = { ...inputRef.current, steer: 0 };
          onInput(inputRef.current);

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

  const handleAccelStart = useCallback(() => {
    inputRef.current = { ...inputRef.current, accel: 1 };
    onInput(inputRef.current);
  }, [onInput]);

  const handleAccelEnd = useCallback(() => {
    inputRef.current = { ...inputRef.current, accel: 0 };
    onInput(inputRef.current);
  }, [onInput]);

  const handleBrakeStart = useCallback(() => {
    inputRef.current = { ...inputRef.current, brake: 1 };
    onInput(inputRef.current);
  }, [onInput]);

  const handleBrakeEnd = useCallback(() => {
    inputRef.current = { ...inputRef.current, brake: 0 };
    onInput(inputRef.current);
  }, [onInput]);

  if (!isTouchDevice) return null;

  return (
    <div className={styles.touchControls}>
      <div className={styles.joystick} ref={joystickRef}>
        <div className={styles.joystickKnob} ref={knobRef} />
      </div>
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.brakeBtn}`}
          onTouchStart={handleBrakeStart}
          onTouchEnd={handleBrakeEnd}
          onTouchCancel={handleBrakeEnd}
        >
          B
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.accelBtn}`}
          onTouchStart={handleAccelStart}
          onTouchEnd={handleAccelEnd}
          onTouchCancel={handleAccelEnd}
        >
          A
        </button>
      </div>
    </div>
  );
}
