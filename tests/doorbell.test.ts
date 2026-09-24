import { describe, expect, it, vi } from "vitest";
import { createDoorbell } from "../src/lib/doorbell";

describe("arrival chime", () => {
  it("waits for audio permission, plays two short descending notes, and closes on leave", async () => {
    const frequencies: number[] = [],
      stops: number[] = [],
      levels: number[] = [];
    const context = {
      state: "suspended",
      currentTime: 10,
      destination: {},
      resume: vi.fn(async () => {
        context.state = "running";
      }),
      close: vi.fn(async () => {
        context.state = "closed";
      }),
      createOscillator: vi.fn(() => ({
        frequency: { setValueAtTime: (n: number) => frequencies.push(n) },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: (at: number) => stops.push(at),
      })),
      createGain: () => ({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: (n: number) => levels.push(n),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
    };
    const bell = createDoorbell(() => context as unknown as AudioContext);
    bell.ring();
    expect(context.createOscillator).not.toHaveBeenCalled();
    await bell.unlock();
    bell.ring();
    expect(frequencies).toEqual([659.25, 523.25]);
    expect(levels).toEqual([0.075, 0.075]);
    expect(stops).toEqual([10.65, 10.950000000000001]);
    bell.close();
    bell.ring();
    expect(context.close).toHaveBeenCalledOnce();
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
  });
  it("tolerates unavailable audio without affecting the visual notification", async () => {
    const bell = createDoorbell(() => {
      throw new Error("Audio disabled");
    });
    await expect(bell.unlock()).resolves.toBeUndefined();
    expect(() => bell.ring()).not.toThrow();
    expect(() => bell.close()).not.toThrow();
  });
});
