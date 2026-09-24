export const HEARTBEAT_INTERVAL_MS = 20_000;
export const PRESENCE_TIMEOUT_MS = 120_000;
export const AWAY_AFTER_MS = 45_000;

export function isPresent(lastSeen: number, now = Date.now()) {
  return lastSeen + PRESENCE_TIMEOUT_MS > now;
}
