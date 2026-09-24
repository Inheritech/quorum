// A short, locally synthesized chime. No recordings, network requests, or looping audio.
export function createDoorbell(
  createContext: () => AudioContext = () => new AudioContext(),
) {
  let context: AudioContext | null = null;
  let disposed = false;
  return {
    async unlock() {
      if (disposed) return;
      try {
        context ??= createContext();
        if (context.state === "suspended") await context.resume();
      } catch {
        /* The browser may require another user gesture. */
      }
    },
    ring() {
      if (disposed || context?.state !== "running") return;
      try {
        const start = context.currentTime;
        for (const [offset, frequency] of [
          [0, 659.25],
          [0.3, 523.25],
        ]) {
          const tone = context.createOscillator();
          const gain = context.createGain();
          const at = start + offset;
          tone.type = "sine";
          tone.frequency.setValueAtTime(frequency, at);
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(0.075, at + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.001, at + 0.6);
          tone.connect(gain);
          gain.connect(context.destination);
          tone.onended = () => {
            tone.disconnect();
            gain.disconnect();
          };
          tone.start(at);
          tone.stop(at + 0.65);
        }
      } catch {
        /* Visual and screen-reader notifications remain available. */
      }
    },
    close() {
      disposed = true;
      if (context && context.state !== "closed")
        void context.close().catch(() => {});
      context = null;
    },
  };
}
