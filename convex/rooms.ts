import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { item } from "./schema";
import {
  assertCiphertext,
  assertHash,
  assertId,
  assertRound,
  authorize,
  creationLimit,
  fail,
  findRoom,
  hostOnly,
  throttle,
  tokenHash,
} from "./lib";

const credentials = { accessHash: v.string(), token: v.string() };
const roundCredentials = { ...credentials, round: v.number() };

export const create = mutation({
  args: {
    ...credentials,
    memberId: v.string(),
    name: v.string(),
    config: v.string(),
    ttlHours: v.number(),
    requireApproval: v.boolean(),
    role: v.union(v.literal("voter"), v.literal("observer")),
  },
  handler: async (ctx, args): Promise<null> => {
    assertHash(args.accessHash);
    assertId(args.memberId);
    assertCiphertext(args.name);
    assertCiphertext(args.config);
    if (![1, 2, 4, 8].includes(args.ttlHours))
      fail("Choose a room lifetime of 1, 2, 4, or 8 hours.");
    // Includes expired rooms awaiting deletion; avoids ambiguous indexed lookups.
    if (
      await ctx.db
        .query("rooms")
        .withIndex("by_access", (q) => q.eq("accessHash", args.accessHash))
        .unique()
    )
      fail("Please generate a new room code.");
    const hash = await tokenHash(args.token);
    await creationLimit(ctx);
    const expiresAt = Date.now() + args.ttlHours * 3_600_000;
    const roomId = await ctx.db.insert("rooms", {
      accessHash: args.accessHash,
      config: args.config,
      hostId: args.memberId,
      participants: [
        {
          id: args.memberId,
          tokenHash: hash,
          name: args.name,
          role: args.role,
          vote: null,
          lastSeen: Date.now(),
          lastWrite: 0,
        },
      ],
      items: [],
      pending: [],
      requireApproval: args.requireApproval,
      round: 1,
      revealed: false,
      locked: false,
      expiresAt,
    });
    const cleanupId = await ctx.scheduler.runAt(
      expiresAt,
      internal.cleanup.expire,
      { roomId },
    );
    await ctx.db.patch(roomId, { cleanupId });
    return null;
  },
});

export const join = mutation({
  args: {
    ...credentials,
    memberId: v.string(),
    name: v.string(),
    role: v.union(v.literal("voter"), v.literal("observer")),
  },
  handler: async (ctx, args) => {
    assertId(args.memberId);
    assertCiphertext(args.name);
    const room = await findRoom(ctx, args.accessHash);
    if (!room)
      fail(
        "That room is unavailable. Check the code or ask the host for a new room.",
      );
    const hash = await tokenHash(args.token);
    if (
      [...room.participants, ...room.pending].some(
        (member) => member.tokenHash === hash,
      )
    )
      return;
    if (room.locked) fail("This room is locked. Ask the host to unlock it.");
    if (room.participants.length >= 32 || room.pending.length >= 32)
      fail("This room is full. Please try again later.");
    if (
      [...room.participants, ...room.pending].some(
        (member) => member.id === args.memberId,
      )
    )
      fail("Please try joining again.");
    const field = room.requireApproval ? "pending" : "participants";
    await ctx.db.patch(room._id, {
      [field]: [
        ...room[field],
        {
          id: args.memberId,
          tokenHash: hash,
          name: args.name,
          role: args.role,
          vote: null,
          lastSeen: Date.now(),
          lastWrite: 0,
        },
      ],
    });
  },
});

export const read = query({
  args: credentials,
  handler: async (ctx, args) => {
    const room = await findRoom(ctx, args.accessHash);
    if (!room) return null;
    const hash = await tokenHash(args.token);
    const me = room.participants.find((member) => member.tokenHash === hash);
    if (!me)
      return room.pending.some((member) => member.tokenHash === hash)
        ? { status: "pending" as const, expiresAt: room.expiresAt }
        : null;
    // Explicit projection: never send other votes before reveal, even to the host.
    // Tokens, token hashes, database IDs, and scheduled function IDs stay private.
    return {
      status: "ready" as const,
      config: room.config,
      hostId: room.hostId,
      round: room.round,
      revealed: room.revealed,
      requireApproval: room.requireApproval,
      pending:
        me.id === room.hostId
          ? room.pending.map(({ id, name }) => ({ id, name }))
          : [],
      locked: room.locked,
      expiresAt: room.expiresAt,
      items: room.items,
      participants: room.participants.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        lastSeen: member.lastSeen,
        hasVoted: member.vote !== null,
        vote: room.revealed || member.id === me.id ? member.vote : null,
      })),
    };
  },
});

export const vote = mutation({
  args: { ...roundCredentials, vote: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const { room, member } = await authorize(ctx, args.accessHash, args.token);
    assertRound(room, args.round);
    throttle(member);
    if (member.role !== "voter") fail("Observers cannot vote.");
    if (!room.items.length) fail("Add an item before voting.");
    if (room.revealed) fail("This round has already been revealed.");
    if (args.vote !== null) assertCiphertext(args.vote);
    await ctx.db.patch(room._id, {
      participants: room.participants.map((entry) =>
        entry.id === member.id
          ? {
              ...entry,
              vote: args.vote,
              lastWrite: Date.now(),
              lastSeen: Date.now(),
            }
          : entry,
      ),
    });
  },
});

export const reveal = mutation({
  args: roundCredentials,
  handler: async (ctx, args) => {
    const { room, member } = await authorize(ctx, args.accessHash, args.token);
    hostOnly(room, member);
    assertRound(room, args.round);
    if (
      !room.items.length ||
      !room.participants.some(
        (entry) => entry.role === "voter" && entry.vote !== null,
      )
    )
      fail("Wait for at least one vote before revealing.");
    await ctx.db.patch(room._id, { revealed: true });
  },
});

export const reset = mutation({
  args: roundCredentials,
  handler: async (ctx, args) => {
    const { room, member } = await authorize(ctx, args.accessHash, args.token);
    hostOnly(room, member);
    assertRound(room, args.round);
    if (!room.revealed) fail("Reveal the cards before starting another round.");
    await ctx.db.patch(room._id, {
      revealed: false,
      round: room.round + 1,
      participants: room.participants.map((entry) => ({
        ...entry,
        vote: null,
        lastWrite: 0,
      })),
    });
  },
});

export const addItem = mutation({
  args: { ...credentials, item },
  handler: async (ctx, args) => {
    const { room, member } = await authorize(ctx, args.accessHash, args.token);
    assertId(args.item.id);
    assertCiphertext(args.item.content);
    throttle(member);
    if (room.items.some((entry) => entry.id === args.item.id)) return;
    if (room.items.length >= 30)
      fail("The queue is full. Finish an item before adding more.");
    await ctx.db.patch(room._id, {
      items: [...room.items, args.item],
      participants: room.participants.map((entry) =>
        entry.id === member.id ? { ...entry, lastWrite: Date.now() } : entry,
      ),
    });
  },
});

export const nextItem = mutation({
  args: roundCredentials,
  handler: async (ctx, args) => {
    const { room, member } = await authorize(ctx, args.accessHash, args.token);
    hostOnly(room, member);
    assertRound(room, args.round);
    if (!room.revealed)
      fail("Reveal the cards before moving to the next item.");
    await ctx.db.patch(room._id, {
      items: room.items.slice(1),
      round: room.round + 1,
      revealed: false,
      participants: room.participants.map((entry) => ({
        ...entry,
        vote: null,
        lastWrite: 0,
      })),
    });
  },
});

export const removeItem = mutation({
  args: { ...credentials, itemId: v.string() },
  handler: async (ctx, args) => {
    const { room, member } = await authorize(ctx, args.accessHash, args.token);
    hostOnly(room, member);
    if (room.items[0]?.id === args.itemId)
      fail("Finish the current item before removing it.");
    await ctx.db.patch(room._id, {
      items: room.items.filter((entry) => entry.id !== args.itemId),
    });
  },
});

export const setRole = mutation({
  args: {
    ...credentials,
    role: v.union(v.literal("voter"), v.literal("observer")),
  },
  handler: async (ctx, args) => {
    const { room, member } = await authorize(ctx, args.accessHash, args.token);
    if (room.revealed) fail("Change your role when the next round starts.");
    await ctx.db.patch(room._id, {
      participants: room.participants.map((entry) =>
        entry.id === member.id
          ? { ...entry, role: args.role, vote: null }
          : entry,
      ),
    });
  },
});

export const setLocked = mutation({
  args: { ...credentials, locked: v.boolean() },
  handler: async (ctx, args) => {
    const { room, member } = await authorize(ctx, args.accessHash, args.token);
    hostOnly(room, member);
    await ctx.db.patch(room._id, { locked: args.locked });
  },
});

export const heartbeat = mutation({
  args: credentials,
  handler: async (ctx, args) => {
    const { room, member } = await authorize(ctx, args.accessHash, args.token);
    if (Date.now() - member.lastSeen < 15_000) return;
    await ctx.db.patch(room._id, {
      participants: room.participants.map((entry) =>
        entry.id === member.id ? { ...entry, lastSeen: Date.now() } : entry,
      ),
    });
  },
});

export const leave = mutation({
  args: credentials,
  handler: async (ctx, args) => {
    const room = await findRoom(ctx, args.accessHash);
    if (!room) return;
    const hash = await tokenHash(args.token);
    const member = room.participants.find((entry) => entry.tokenHash === hash);
    if (!member) {
      await ctx.db.patch(room._id, {
        pending: room.pending.filter((entry) => entry.tokenHash !== hash),
      });
      return;
    }
    if (room.hostId === member.id) {
      if (room.cleanupId) await ctx.scheduler.cancel(room.cleanupId);
      await ctx.db.delete(room._id);
    } else {
      await ctx.db.patch(room._id, {
        participants: room.participants.filter(
          (entry) => entry.id !== member.id,
        ),
      });
    }
  },
});

export const admit = mutation({
  args: { ...credentials, memberId: v.string(), allow: v.boolean() },
  handler: async (ctx, args) => {
    const { room, member } = await authorize(ctx, args.accessHash, args.token);
    hostOnly(room, member);
    const applicant = room.pending.find((entry) => entry.id === args.memberId);
    if (!applicant) return;
    if (args.allow && room.participants.length >= 32)
      fail("This room has reached its 32-person limit.");
    await ctx.db.patch(room._id, {
      pending: room.pending.filter((entry) => entry.id !== args.memberId),
      participants: args.allow
        ? [...room.participants, { ...applicant, lastSeen: Date.now() }]
        : room.participants,
    });
  },
});
