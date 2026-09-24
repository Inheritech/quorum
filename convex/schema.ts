import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const participant = v.object({
  id: v.string(),
  tokenHash: v.string(),
  name: v.string(),
  role: v.union(v.literal("voter"), v.literal("observer")),
  vote: v.union(v.string(), v.null()),
  lastSeen: v.number(),
  lastWrite: v.number(),
});
export const item = v.object({ id: v.string(), content: v.string() });
export default defineSchema({
  rooms: defineTable({
    accessHash: v.string(),
    config: v.string(),
    hostId: v.string(),
    participants: v.array(participant),
    pending: v.array(participant),
    items: v.array(item),
    requireApproval: v.boolean(),
    round: v.number(),
    revealed: v.boolean(),
    locked: v.boolean(),
    expiresAt: v.number(),
    presenceCheckAt: v.optional(v.number()),
    hostChangedAt: v.optional(v.number()),
    cleanupId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_access", ["accessHash"])
    .index("by_expiry", ["expiresAt"])
    .index("by_presence", ["presenceCheckAt"]),
  limits: defineTable({
    key: v.string(),
    count: v.number(),
    expiresAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_expiry", ["expiresAt"]),
});
