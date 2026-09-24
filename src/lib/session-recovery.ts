import { normalizeRoomCode, roomAccessHash, roomEncryptionKey } from "./crypto";
import type { Session } from "./room";

export const RECOVERY_STORAGE_KEY = "quorum.session.v1";
export type StoredSession = Pick<
  Session,
  "code" | "token" | "memberId" | "expiresAt" | "recoverUntil"
>;
export type PresenceReceipt = {
  memberId: string;
  expiresAt: number;
  recoverUntil: number;
};
type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function tabStorage(): StorageAccess | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
export function clearRecovery(storage = tabStorage()) {
  try {
    storage?.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    /* Storage may be unavailable. */
  }
}
export function saveRecovery(
  session: StoredSession,
  storage = tabStorage(),
): boolean {
  if (!storage) return false;
  try {
    // Deliberately exclude decrypted content, names, votes, and CryptoKey objects.
    storage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        code: session.code,
        token: session.token,
        memberId: session.memberId,
        expiresAt: session.expiresAt,
        recoverUntil: session.recoverUntil,
      }),
    );
    return true;
  } catch {
    clearRecovery(storage);
    return false;
  }
}
export function readRecovery(
  storage = tabStorage(),
  now = Date.now(),
): StoredSession | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(RECOVERY_STORAGE_KEY);
    if (!value) return null;
    if (value.length > 4096) throw new Error();
    const entry = JSON.parse(value);
    if (
      entry.version !== 1 ||
      typeof entry.code !== "string" ||
      typeof entry.token !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.token) ||
      typeof entry.memberId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(entry.memberId) ||
      !Number.isFinite(entry.expiresAt) ||
      !Number.isFinite(entry.recoverUntil) ||
      entry.expiresAt <= now ||
      entry.recoverUntil <= now ||
      entry.recoverUntil > entry.expiresAt
    )
      throw new Error();
    return {
      code: normalizeRoomCode(entry.code),
      token: entry.token,
      memberId: entry.memberId,
      expiresAt: entry.expiresAt,
      recoverUntil: entry.recoverUntil,
    };
  } catch {
    clearRecovery(storage);
    return null;
  }
}

export async function recoverSession(
  record: StoredSession,
  renew: (credentials: {
    accessHash: string;
    token: string;
  }) => Promise<PresenceReceipt | null>,
): Promise<Session | null> {
  const accessHash = await roomAccessHash(record.code);
  // Recovery can renew an existing member only. It never calls join/create.
  const receipt = await renew({ accessHash, token: record.token });
  if (!receipt || receipt.memberId !== record.memberId) return null;
  return {
    ...record,
    ...receipt,
    accessHash,
    key: await roomEncryptionKey(record.code),
  };
}
