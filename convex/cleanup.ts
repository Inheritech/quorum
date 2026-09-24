import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { isPresent, PRESENCE_TIMEOUT_MS } from "../src/lib/presence";

// Full rooms contain padded ciphertext; keep transaction read sizes modest.
const ROOM_BATCH_SIZE = 10;

// Runs independently of browsers, including for rooms whose last client vanished.
// The optional index field also picks up rooms created before presence cleanup existed.
export const presence = internalMutation({
  args: {},
  handler: async (ctx): Promise<null> => {
    const now = Date.now();
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_presence", (q) => q.lte("presenceCheckAt", now))
      .take(ROOM_BATCH_SIZE);
    for (const room of rooms) {
      const participants = room.participants.filter((entry) =>
        isPresent(entry.lastSeen, now),
      );
      const pending = room.pending.filter((entry) =>
        isPresent(entry.lastSeen, now),
      );
      if (!participants.length || room.expiresAt <= now) {
        // Expiry remains idempotent if its scheduled call runs after this deletion.
        await ctx.db.delete(room._id);
        continue;
      }
      const hostRemains = participants.some(
        (entry) => entry.id === room.hostId,
      );
      await ctx.db.patch(room._id, {
        participants,
        pending,
        hostId: hostRemains ? room.hostId : participants[0].id,
        ...(hostRemains ? {} : { hostChangedAt: now }),
        presenceCheckAt: Math.min(
          ...[...participants, ...pending].map(
            (entry) => entry.lastSeen + PRESENCE_TIMEOUT_MS,
          ),
        ),
      });
    }
    if (rooms.length === ROOM_BATCH_SIZE)
      await ctx.scheduler.runAfter(0, internal.cleanup.presence, {});
    return null;
  },
});

export const expire = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (room && room.expiresAt <= Date.now()) await ctx.db.delete(roomId);
  },
});

// Backstop for missed/delayed expiry work; bounded batches also handle restore cleanup.
export const sweep = internalMutation({
  args: {},
  handler: async (ctx): Promise<null> => {
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_expiry", (q) => q.lte("expiresAt", Date.now()))
      .take(ROOM_BATCH_SIZE);
    for (const room of rooms) {
      // Restored records may reference absent scheduler entries. Deletion must
      // succeed independently; any surviving expiry task is already idempotent.
      await ctx.db.delete(room._id);
    }
    const limits = await ctx.db
      .query("limits")
      .withIndex("by_expiry", (q) => q.lte("expiresAt", Date.now()))
      .take(100);
    for (const limit of limits) await ctx.db.delete(limit._id);
    if (rooms.length === ROOM_BATCH_SIZE || limits.length === 100)
      await ctx.scheduler.runAfter(0, internal.cleanup.sweep, {});
    return null;
  },
});
