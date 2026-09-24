import { describe, expect, it, vi } from "vitest";
import {
  clearRecovery,
  readRecovery,
  RECOVERY_STORAGE_KEY,
  saveRecovery,
  recoverSession,
} from "../src/lib/session-recovery";
import { generateRoomCode, generateToken } from "../src/lib/crypto";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
function record() {
  return {
    code: generateRoomCode(),
    token: generateToken(),
    memberId: crypto.randomUUID(),
    expiresAt: Date.now() + 3_600_000,
    recoverUntil: Date.now() + 120_000,
  };
}

describe("tab session credentials", () => {
  it("stores only recovery credentials, round trips, and clears only its own key", () => {
    const tab = storage(),
      entry = record();
    const session = {
      ...entry,
      name: "Secret name",
      vote: 3,
      config: { name: "Secret room" },
      key: "Secret key object",
    };
    tab.setItem("unrelated", "keep");
    expect(saveRecovery(session, tab)).toBe(true);
    expect(readRecovery(tab)).toEqual(entry);
    expect(
      Object.keys(JSON.parse(tab.getItem(RECOVERY_STORAGE_KEY)!)).sort(),
    ).toEqual([
      "code",
      "expiresAt",
      "memberId",
      "recoverUntil",
      "token",
      "version",
    ]);
    clearRecovery(tab);
    expect(readRecovery(tab)).toBeNull();
    expect(tab.getItem("unrelated")).toBe("keep");
  });
  it("clears expired, malformed, and unsupported session records", () => {
    for (const value of [
      "{",
      "null",
      JSON.stringify({ ...record(), version: 9 }),
      JSON.stringify({ ...record(), version: 1, token: "guessable" }),
      JSON.stringify({ ...record(), version: 1, recoverUntil: Date.now() }),
      JSON.stringify({ ...record(), version: 1, expiresAt: Date.now() - 1 }),
      "x".repeat(4097),
    ]) {
      const tab = storage();
      tab.setItem(RECOVERY_STORAGE_KEY, value);
      expect(readRecovery(tab)).toBeNull();
      expect(tab.getItem(RECOVERY_STORAGE_KEY)).toBeNull();
    }
  });
  it("keeps storage failures from breaking a live session", () => {
    const blocked = {
      getItem: () => {
        throw new Error();
      },
      setItem: () => {
        throw new Error();
      },
      removeItem: () => {
        throw new Error();
      },
    };
    expect(saveRecovery(record(), blocked)).toBe(false);
    expect(readRecovery(blocked)).toBeNull();
    expect(() => clearRecovery(blocked)).not.toThrow();
  });
  it("never treats a different returned participant as recovered", async () => {
    const entry = record();
    const renew = vi.fn(async () => ({
      ...entry,
      memberId: crypto.randomUUID(),
    }));
    expect(await recoverSession(entry, renew)).toBeNull();
    expect(renew).toHaveBeenCalledExactlyOnceWith({
      accessHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      token: entry.token,
    });
  });
});
