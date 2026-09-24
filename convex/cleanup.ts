import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

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
      .take(100);
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
    if (rooms.length === 100 || limits.length === 100)
      await ctx.scheduler.runAfter(0, internal.cleanup.sweep, {});
    return null;
  },
});
