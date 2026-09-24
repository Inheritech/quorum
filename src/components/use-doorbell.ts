"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createDoorbell } from "@/lib/doorbell";

export function useDoorbell() {
  const bell = useRef<ReturnType<typeof createDoorbell> | null>(null);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const sound = createDoorbell();
    bell.current = sound;
    const unlock = () => {
      void sound.unlock();
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    if (navigator.userActivation?.hasBeenActive) unlock();
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      sound.close();
      bell.current = null;
    };
  }, []);
  const ring = useCallback(() => {
    if (!mutedRef.current) bell.current?.ring();
  }, []);
  const toggleMuted = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  };
  return { muted, toggleMuted, ring };
}
