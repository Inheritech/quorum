import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

export function fail(message: string): never {
  throw new ConvexError(message);
}
export function assertHash(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) fail("Invalid room credentials.");
}
export function assertId(value: string) {
  if (!/^[a-f0-9-]{36}$/.test(value)) fail("Invalid participant or item.");
}
export function assertCiphertext(value: string) {
  // 12-byte IV, 2,048 bytes of padded plaintext, and 16-byte authentication tag.
  if (!/^v1\.[A-Za-z0-9+/]{16}\.[A-Za-z0-9+/]{2752}$/.test(value))
    fail("Invalid encrypted content.");
}
export async function tokenHash(token: string) {
  assertHash(token);
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`quorum:session:v1:${token}`),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function findRoom(ctx: QueryCtx, accessHash: string) {
  assertHash(accessHash);
  const room = await ctx.db
    .query("rooms")
    .withIndex("by_access", (q) => q.eq("accessHash", accessHash))
    .unique();
  return room && room.expiresAt > Date.now() ? room : null;
}
export async function authorize(
  ctx: QueryCtx,
  accessHash: string,
  token: string,
) {
  const room = await findRoom(ctx, accessHash);
  if (!room) fail("This room has ended or expired.");
  const hash = await tokenHash(token);
  const member = room.participants.find((entry) => entry.tokenHash === hash);
  if (!member) fail("You’re no longer a member of this room.");
  return { room, member };
}
export function hostOnly(
  room: Doc<"rooms">,
  member: Doc<"rooms">["participants"][number],
) {
  if (room.hostId !== member.id) fail("Only the host can do that.");
}
export function assertRound(room: Doc<"rooms">, round: number) {
  if (room.round !== round)
    fail("The round changed. Try again with the current item.");
}
export function throttle(member: Doc<"rooms">["participants"][number]) {
  if (Date.now() - member.lastWrite < 200)
    fail("A little too fast. Try again in a moment.");
}
export async function creationLimit(ctx: MutationCtx) {
  const existing = await ctx.db
    .query("limits")
    .withIndex("by_key", (q) => q.eq("key", "create"))
    .unique();
  if (existing && existing.expiresAt > Date.now()) {
    if (existing.count >= 60)
      fail("Room creation is busy. Please try again in a minute.");
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
  } else if (existing) {
    await ctx.db.patch(existing._id, {
      count: 1,
      expiresAt: Date.now() + 60_000,
    });
  } else {
    await ctx.db.insert("limits", {
      key: "create",
      count: 1,
      expiresAt: Date.now() + 60_000,
    });
  }
}
