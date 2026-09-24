"use client";
import { useEffect, useState } from "react";

export function useRevealCountdown(round: number, revealed: boolean) {
  // Someone joining an already revealed round sees its results immediately.
  const [initiallyRevealedRound] = useState(revealed ? round : null);
  const [count, setCount] = useState({ round, remaining: revealed ? 0 : 3 });
  useEffect(() => {
    if (!revealed || round === initiallyRevealedRound) return;
    const timers = [1, 2, 3].map((second) =>
      window.setTimeout(() => {
        setCount({ round, remaining: 3 - second });
      }, second * 1000),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [round, revealed, initiallyRevealedRound]);
  const remaining =
    round === initiallyRevealedRound
      ? 0
      : count.round === round
        ? count.remaining
        : 3;
  return {
    countingDown: revealed && remaining > 0,
    remaining,
    revealed: revealed && remaining === 0,
  };
}
