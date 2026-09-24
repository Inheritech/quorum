import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { recoverSession } from "../src/lib/session-recovery";
import { PRESENCE_TIMEOUT_MS } from "../src/lib/presence";
import {
  generateRoomCode,
  generateToken,
  roomAccessHash,
  roomEncryptionKey,
  seal,
  unseal,
} from "../src/lib/crypto";

const modules = {
  "../convex/_generated/api.ts": () => import("../convex/_generated/api"),
  "../convex/rooms.ts": () => import("../convex/rooms"),
  "../convex/cleanup.ts": () => import("../convex/cleanup"),
};
const newTest = () => convexTest(schema, modules);
type Test = ReturnType<typeof newTest>;

async function setup(t: Test, requireApproval = false) {
  const code = generateRoomCode();
  const key = await roomEncryptionKey(code),
    accessHash = await roomAccessHash(code);
  const hostId = crypto.randomUUID(),
    token = generateToken();
  const config = {
    name: "Confidential sprint",
    deck: "fibonacci",
    cards: ["1", "2", "3", "5", "?"],
  };
  await t.mutation(api.rooms.create, {
    accessHash,
    token,
    memberId: hostId,
    name: await seal(key, "Host", `${accessHash}:name:${hostId}`),
    config: await seal(key, config, `${accessHash}:config`),
    ttlHours: 1,
    requireApproval,
    role: "voter",
  });
  const host = { accessHash, token };
  const id = crypto.randomUUID();
  await t.mutation(api.rooms.addItem, {
    ...host,
    item: {
      id,
      content: await seal(
        key,
        { name: "Payroll migration", url: "https://private.example/HR-22" },
        `${accessHash}:item:${id}`,
      ),
    },
  });
  return { key, accessHash, code, hostId, host };
}
async function join(
  t: Test,
  context: Awaited<ReturnType<typeof setup>>,
  role: "voter" | "observer" = "voter",
) {
  const token = generateToken(),
    memberId = crypto.randomUUID();
  const credentials = { accessHash: context.accessHash, token };
  await t.mutation(api.rooms.join, {
    ...credentials,
    memberId,
    role,
    name: await seal(
      context.key,
      "Guest",
      `${context.accessHash}:name:${memberId}`,
    ),
  });
  return { credentials, memberId };
}
async function vote(
  t: Test,
  context: Awaited<ReturnType<typeof setup>>,
  member: Awaited<ReturnType<typeof join>>,
  index: number,
) {
  await t.mutation(api.rooms.vote, {
    ...member.credentials,
    round: 1,
    vote: await seal(
      context.key,
      index,
      `${context.accessHash}:vote:${member.memberId}:1`,
    ),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-24T15:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("room authorization and encrypted data", () => {
  it("never persists plaintext content, room secrets, or raw session tokens", async () => {
    const t = newTest(),
      context = await setup(t);
    const records = await t.run((ctx) => ctx.db.query("rooms").collect());
    const serialized = JSON.stringify(records);
    for (const secret of [
      context.code,
      context.host.token,
      "Confidential sprint",
      "Payroll migration",
      "private.example",
      '"Host"',
    ])
      expect(serialized).not.toContain(secret);
    const view = await t.query(api.rooms.read, context.host);
    expect(JSON.stringify(view)).not.toContain("tokenHash");
    expect(JSON.stringify(view)).not.toContain("cleanupId");
    expect(view?.status).toBe("ready");
    if (view?.status === "ready")
      expect(
        await unseal(context.key, view.config, `${context.accessHash}:config`),
      ).toMatchObject({ name: "Confidential sprint" });
  });
  it("withholds unrevealed votes from everyone else, including the host and observers", async () => {
    const t = newTest(),
      context = await setup(t),
      guest = await join(t, context),
      observer = await join(t, context, "observer");
    await vote(t, context, guest, 3);
    for (const credentials of [context.host, observer.credentials]) {
      const view = await t.query(api.rooms.read, credentials);
      expect(view?.status).toBe("ready");
      if (view?.status === "ready")
        expect(
          view.participants.find((entry) => entry.id === guest.memberId),
        ).toMatchObject({ hasVoted: true, vote: null });
    }
    const own = await t.query(api.rooms.read, guest.credentials);
    if (own?.status === "ready")
      expect(
        own.participants.find((entry) => entry.id === guest.memberId)?.vote,
      ).toMatch(/^v1\./);
    await t.mutation(api.rooms.reveal, { ...context.host, round: 1 });
    const revealed = await t.query(api.rooms.read, observer.credentials);
    if (revealed?.status !== "ready") throw new Error("Expected room");
    const encrypted = revealed.participants.find(
      (entry) => entry.id === guest.memberId,
    )!.vote!;
    expect(
      await unseal(
        context.key,
        encrypted,
        `${context.accessHash}:vote:${guest.memberId}:1`,
      ),
    ).toBe(3);
  });
  it("denies forged credentials, observer votes, and non-host controls", async () => {
    const t = newTest(),
      context = await setup(t),
      guest = await join(t, context),
      observer = await join(t, context, "observer");
    expect(
      await t.query(api.rooms.read, {
        accessHash: context.accessHash,
        token: generateToken(),
      }),
    ).toBeNull();
    await expect(vote(t, context, observer, 2)).rejects.toThrow(
      "Observers cannot vote",
    );
    await expect(
      t.mutation(api.rooms.reveal, { ...guest.credentials, round: 1 }),
    ).rejects.toThrow("Only the host");
    await expect(
      t.mutation(api.rooms.setLocked, { ...guest.credentials, locked: true }),
    ).rejects.toThrow("Only the host");
    await expect(
      t.mutation(api.rooms.admit, {
        ...guest.credentials,
        memberId: observer.memberId,
        allow: true,
      }),
    ).rejects.toThrow("Only the host");
    await expect(
      t.mutation(api.rooms.nextItem, { ...guest.credentials, round: 1 }),
    ).rejects.toThrow("Only the host");
  });
  it("gives pending guests only waiting status and admits or denies them explicitly", async () => {
    const t = newTest(),
      context = await setup(t, true),
      guest = await join(t, context);
    expect(await t.query(api.rooms.read, guest.credentials)).toEqual({
      status: "pending",
      expiresAt: Date.now() + 3_600_000,
    });
    await expect(vote(t, context, guest, 1)).rejects.toThrow(
      "no longer a member",
    );
    const hostView = await t.query(api.rooms.read, context.host);
    if (hostView?.status !== "ready") throw new Error("Expected room");
    expect(hostView.pending).toHaveLength(1);
    expect(JSON.stringify(hostView.pending)).not.toContain("tokenHash");
    await t.mutation(api.rooms.admit, {
      ...context.host,
      memberId: guest.memberId,
      allow: true,
    });
    expect((await t.query(api.rooms.read, guest.credentials))?.status).toBe(
      "ready",
    );
    const other = await join(t, context);
    await t.mutation(api.rooms.admit, {
      ...context.host,
      memberId: other.memberId,
      allow: false,
    });
    expect(await t.query(api.rooms.read, other.credentials)).toBeNull();
  });
  it("locks new joins and lets pending guests cancel without seeing room data", async () => {
    const t = newTest(),
      context = await setup(t, true),
      guest = await join(t, context);
    await t.mutation(api.rooms.leave, guest.credentials);
    expect(await t.query(api.rooms.read, guest.credentials)).toBeNull();
    await t.mutation(api.rooms.setLocked, { ...context.host, locked: true });
    await expect(join(t, context)).rejects.toThrow("locked");
    await t.mutation(api.rooms.setLocked, { ...context.host, locked: false });
    expect((await join(t, context)).memberId).toBeTruthy();
  });
});

describe("queue progression and retention", () => {
  it("requires reveal before advancing, discards the old item and votes, and rejects stale-round actions", async () => {
    const t = newTest(),
      context = await setup(t),
      guest = await join(t, context);
    const nextId = crypto.randomUUID();
    await t.mutation(api.rooms.addItem, {
      ...guest.credentials,
      item: {
        id: nextId,
        content: await seal(
          context.key,
          { name: "Next item", url: "" },
          `${context.accessHash}:item:${nextId}`,
        ),
      },
    });
    await expect(
      t.mutation(api.rooms.nextItem, { ...context.host, round: 1 }),
    ).rejects.toThrow("Reveal the cards");
    vi.setSystemTime(Date.now() + 300);
    await vote(t, context, guest, 2);
    await t.mutation(api.rooms.reveal, { ...context.host, round: 1 });
    await t.mutation(api.rooms.nextItem, { ...context.host, round: 1 });
    const view = await t.query(api.rooms.read, context.host);
    if (view?.status !== "ready") throw new Error("Expected room");
    expect(view.items.map((entry) => entry.id)).toEqual([nextId]);
    expect(view).toMatchObject({ round: 2, revealed: false });
    expect(
      view.participants.every(
        (member) => !member.hasVoted && member.vote === null,
      ),
    ).toBe(true);
    await expect(vote(t, context, guest, 1)).rejects.toThrow("round changed");
    await expect(
      t.mutation(api.rooms.nextItem, { ...context.host, round: 1 }),
    ).rejects.toThrow("round changed");
  });
  it("supports revoting and switching to observer without retaining an old vote", async () => {
    const t = newTest(),
      context = await setup(t),
      guest = await join(t, context);
    await vote(t, context, guest, 2);
    await t.mutation(api.rooms.setRole, {
      ...guest.credentials,
      role: "observer",
    });
    const view = await t.query(api.rooms.read, guest.credentials);
    if (view?.status === "ready")
      expect(
        view.participants.find((entry) => entry.id === guest.memberId),
      ).toMatchObject({ role: "observer", hasVoted: false, vote: null });
    await t.mutation(api.rooms.setRole, {
      ...guest.credentials,
      role: "voter",
    });
    vi.setSystemTime(Date.now() + 300);
    await vote(t, context, guest, 2);
    await t.mutation(api.rooms.reveal, { ...context.host, round: 1 });
    await t.mutation(api.rooms.reset, { ...context.host, round: 1 });
    const reset = await t.query(api.rooms.read, context.host);
    if (reset?.status !== "ready") throw new Error("Expected room");
    expect(reset.items).toHaveLength(1);
    expect(reset).toMatchObject({ round: 2, revealed: false });
    expect(reset.participants.every((member) => member.vote === null)).toBe(
      true,
    );
  });
  it("removes a leaving guest and deletes all active content when the host ends the room", async () => {
    const t = newTest(),
      context = await setup(t),
      guest = await join(t, context);
    await vote(t, context, guest, 3);
    await t.mutation(api.rooms.leave, guest.credentials);
    expect(await t.query(api.rooms.read, guest.credentials)).toBeNull();
    const afterLeave = await t.run((ctx) => ctx.db.query("rooms").collect());
    expect(afterLeave[0].participants).toHaveLength(1);
    await t.mutation(api.rooms.leave, context.host);
    expect(await t.run((ctx) => ctx.db.query("rooms").collect())).toEqual([]);
    expect(await t.query(api.rooms.read, context.host)).toBeNull();
  });
  it("denies expired access before cleanup runs and a sweep removes all expired data", async () => {
    const t = newTest(),
      context = await setup(t);
    vi.setSystemTime(Date.now() + 3_600_001);
    expect(await t.query(api.rooms.read, context.host)).toBeNull();
    await expect(
      t.mutation(api.rooms.reveal, { ...context.host, round: 1 }),
    ).rejects.toThrow("ended or expired");
    await t.mutation(internal.cleanup.sweep, {});
    expect(await t.run((ctx) => ctx.db.query("rooms").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("limits").collect())).toEqual([]);
  });
  it("executes scheduled expiry even when all browsers have gone away", async () => {
    const t = newTest();
    await setup(t);
    await vi.advanceTimersByTimeAsync(3_600_001);
    await t.finishInProgressScheduledFunctions();
    expect(await t.run((ctx) => ctx.db.query("rooms").collect())).toEqual([]);
  });
});

describe("presence, removal, and session recovery", () => {
  it("restores the same capability and encrypted vote while locked, without joining again", async () => {
    const t = newTest(),
      context = await setup(t),
      guest = await join(t, context);
    await vote(t, context, guest, 3);
    await t.mutation(api.rooms.setLocked, { ...context.host, locked: true });
    const receipt = await t.mutation(api.rooms.heartbeat, guest.credentials);
    if (!receipt) throw new Error("Missing presence receipt");
    vi.setSystemTime(Date.now() + 90_000);
    const recovered = await recoverSession(
      { ...receipt, code: context.code, token: guest.credentials.token },
      (credentials) => t.mutation(api.rooms.heartbeat, credentials),
    );
    expect(recovered).toMatchObject({
      memberId: guest.memberId,
      token: guest.credentials.token,
      recoverUntil: Date.now() + PRESENCE_TIMEOUT_MS,
    });
    const view = await t.query(api.rooms.read, guest.credentials);
    if (view?.status !== "ready" || !recovered)
      throw new Error("Expected recovered member");
    expect(view.participants).toHaveLength(2);
    const me = view.participants.find((entry) => entry.id === guest.memberId)!;
    expect(
      await unseal(
        recovered.key,
        me.vote!,
        `${context.accessHash}:vote:${guest.memberId}:1`,
      ),
    ).toBe(3);
    expect(
      await unseal(
        recovered.key,
        me.name,
        `${context.accessHash}:name:${guest.memberId}`,
      ),
    ).toBe("Guest");
    await t.mutation(api.rooms.setRole, {
      ...guest.credentials,
      role: "observer",
    });
    expect(
      (await t.query(api.rooms.read, guest.credentials))?.participants?.find(
        (entry) => entry.id === guest.memberId,
      )?.role,
    ).toBe("observer");
  });

  it("renews pending sessions and restores host authority, without changing admission", async () => {
    const t = newTest(),
      context = await setup(t, true),
      guest = await join(t, context);
    vi.setSystemTime(Date.now() + 90_000);
    const pending = await t.mutation(api.rooms.heartbeat, guest.credentials);
    const host = await t.mutation(api.rooms.heartbeat, context.host);
    expect(pending?.recoverUntil).toBe(Date.now() + PRESENCE_TIMEOUT_MS);
    expect(host?.memberId).toBe(context.hostId);
    expect((await t.query(api.rooms.read, guest.credentials))?.status).toBe(
      "pending",
    );
    vi.setSystemTime(Date.now() + 40_000);
    await t.mutation(internal.cleanup.presence, {});
    await t.mutation(api.rooms.setLocked, { ...context.host, locked: true });
    await t.mutation(api.rooms.admit, {
      ...context.host,
      memberId: guest.memberId,
      allow: true,
    });
    expect((await t.query(api.rooms.read, guest.credentials))?.status).toBe(
      "ready",
    );
  });

  it("throttles frequent heartbeats without pretending to renew the deadline", async () => {
    const t = newTest(),
      context = await setup(t);
    const first = await t.mutation(api.rooms.heartbeat, context.host);
    vi.setSystemTime(Date.now() + 10_000);
    expect(await t.mutation(api.rooms.heartbeat, context.host)).toEqual(first);
    vi.setSystemTime(Date.now() + 10_000);
    expect(
      (await t.mutation(api.rooms.heartbeat, context.host))?.recoverUntil,
    ).toBe(Date.now() + PRESENCE_TIMEOUT_MS);
  });

  it("rejects stale capabilities before cleanup and transfers hosting to the oldest fresh person", async () => {
    const t = newTest(),
      context = await setup(t),
      staleGuest = await join(t, context),
      successor = await join(t, context, "observer"),
      guest = await join(t, context);
    vi.setSystemTime(Date.now() + 90_000);
    await t.mutation(api.rooms.heartbeat, successor.credentials);
    await t.mutation(api.rooms.heartbeat, guest.credentials);
    vi.setSystemTime(Date.now() + 30_000);
    expect(await t.mutation(api.rooms.heartbeat, context.host)).toBeNull();
    expect(await t.query(api.rooms.read, context.host)).toBeNull();
    await expect(
      t.mutation(api.rooms.setLocked, { ...context.host, locked: true }),
    ).rejects.toThrow("no longer a member");
    await t.mutation(api.rooms.leave, context.host);
    await t.mutation(internal.cleanup.presence, {});
    const view = await t.query(api.rooms.read, successor.credentials);
    expect(view).toMatchObject({
      hostId: successor.memberId,
      hostChangedAt: Date.now(),
    });
    expect(view?.participants?.map((entry) => entry.id)).toEqual([
      successor.memberId,
      guest.memberId,
    ]);
    expect(
      await t.mutation(api.rooms.heartbeat, staleGuest.credentials),
    ).toBeNull();
    expect(await t.query(api.rooms.read, guest.credentials)).toMatchObject({
      hostId: successor.memberId,
      hostChangedAt: Date.now(),
    });
    await t.mutation(api.rooms.setLocked, {
      ...successor.credentials,
      locked: true,
    });
    await expect(
      t.mutation(api.rooms.setLocked, { ...context.host, locked: false }),
    ).rejects.toThrow("no longer a member");
  });

  it("only lets the host remove others and invalidates removed recovery credentials", async () => {
    const t = newTest(),
      context = await setup(t),
      guest = await join(t, context),
      other = await join(t, context);
    await vote(t, context, guest, 2);
    const receipt = await t.mutation(api.rooms.heartbeat, guest.credentials);
    if (!receipt) throw new Error("Missing receipt");
    await expect(
      t.mutation(api.rooms.removeMember, {
        ...guest.credentials,
        memberId: other.memberId,
      }),
    ).rejects.toThrow("Only the host");
    await expect(
      t.mutation(api.rooms.removeMember, {
        ...context.host,
        memberId: context.hostId,
      }),
    ).rejects.toThrow("End room");
    await t.mutation(api.rooms.removeMember, {
      ...context.host,
      memberId: guest.memberId,
    });
    expect(
      await recoverSession(
        { ...receipt, code: context.code, token: guest.credentials.token },
        (credentials) => t.mutation(api.rooms.heartbeat, credentials),
      ),
    ).toBeNull();
    expect(await t.query(api.rooms.read, guest.credentials)).toBeNull();
    await expect(vote(t, context, guest, 1)).rejects.toThrow(
      "no longer a member",
    );
    const records = await t.run((ctx) => ctx.db.query("rooms").collect());
    expect(records[0].participants.map((entry) => entry.id)).toEqual([
      context.hostId,
      other.memberId,
    ]);
    expect(JSON.stringify(records)).not.toContain(guest.memberId);
  });

  it("does not restore declined applicants or admit disconnected applicants", async () => {
    const t = newTest(),
      context = await setup(t, true),
      guest = await join(t, context),
      stale = await join(t, context);
    await t.mutation(api.rooms.admit, {
      ...context.host,
      memberId: guest.memberId,
      allow: false,
    });
    expect(await t.mutation(api.rooms.heartbeat, guest.credentials)).toBeNull();
    vi.setSystemTime(Date.now() + 90_000);
    await t.mutation(api.rooms.heartbeat, context.host);
    vi.setSystemTime(Date.now() + 30_000);
    await expect(
      t.mutation(api.rooms.admit, {
        ...context.host,
        memberId: stale.memberId,
        allow: true,
      }),
    ).rejects.toThrow("disconnected");
    await t.mutation(internal.cleanup.presence, {});
    expect((await t.query(api.rooms.read, context.host))?.pending).toEqual([]);
  });

  it("ends a room with no fresh admitted members, even with a fresh pending applicant", async () => {
    const t = newTest(),
      context = await setup(t, true),
      guest = await join(t, context);
    vi.setSystemTime(Date.now() + 90_000);
    await t.mutation(api.rooms.heartbeat, guest.credentials);
    vi.setSystemTime(Date.now() + 30_000);
    await expect(join(t, context)).rejects.toThrow("no connected participants");
    await t.mutation(internal.cleanup.presence, {});
    expect(await t.run((ctx) => ctx.db.query("rooms").collect())).toEqual([]);
    expect(await t.mutation(api.rooms.heartbeat, guest.credentials)).toBeNull();
  });

  it("cleans up legacy room records without a presence index timestamp", async () => {
    const t = newTest();
    await setup(t);
    await t.run(async (ctx) => {
      const [room] = await ctx.db.query("rooms").collect();
      await ctx.db.patch(room._id, { presenceCheckAt: undefined });
    });
    vi.setSystemTime(Date.now() + PRESENCE_TIMEOUT_MS);
    await t.mutation(internal.cleanup.presence, {});
    expect(await t.run((ctx) => ctx.db.query("rooms").collect())).toEqual([]);
  });

  it("continues presence cleanup across bounded room batches", async () => {
    const t = newTest();
    for (let i = 0; i < 11; i++) await setup(t);
    vi.setSystemTime(Date.now() + PRESENCE_TIMEOUT_MS);
    await t.mutation(internal.cleanup.presence, {});
    expect(await t.run((ctx) => ctx.db.query("rooms").collect())).toHaveLength(
      1,
    );
    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    expect(await t.run((ctx) => ctx.db.query("rooms").collect())).toEqual([]);
  });
});
