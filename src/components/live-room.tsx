"use client";
import { useEffect, useMemo, useState } from "react";
import {
  useConvex,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "../../convex/_generated/api";
import { seal, unseal } from "@/lib/crypto";
import { validateConfig, type RoomConfig } from "@/lib/decks";
import { validateItem } from "@/lib/items";
import type { Room, RoomActions, Session } from "@/lib/room";
import { RoomView } from "./room-view";
import { Brand } from "./brand";
import { Clock3, LockKeyhole } from "lucide-react";

export function LiveRoom({
  session,
  onExit,
}: {
  session: Session;
  onExit: (reason?: string) => void;
}) {
  const client = useConvex();
  const credentials = useMemo(
    () => ({ accessHash: session.accessHash, token: session.token }),
    [session],
  );
  const raw = useQuery(api.rooms.read, credentials);
  const connection = useConvexConnectionState();
  const heartbeat = useMutation(api.rooms.heartbeat);
  const [decoded, setDecoded] = useState<{
    source: typeof raw;
    room: Room;
  } | null>(null);
  const [decodeError, setDecodeError] = useState(false);
  const [expired, setExpired] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  useEffect(() => {
    if (expired || raw === null)
      onExit(
        "The room ended, expired, or your request wasn’t approved. Your session has been cleared from this tab.",
      );
  }, [expired, raw, onExit]);

  useEffect(() => {
    if (!raw) return;
    const timer = window.setTimeout(
      () => setExpired(true),
      Math.max(0, raw.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [raw]);
  useEffect(() => {
    if (raw?.status !== "ready" || expired) return;
    const timer = window.setInterval(() => {
      void heartbeat(credentials).catch(() => {
        /* The subscription supplies room closure; no sensitive error logging. */
      });
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [raw?.status, expired, credentials, heartbeat]);
  useEffect(() => {
    if (raw?.status !== "ready") return;
    let active = true;
    async function decrypt() {
      if (raw?.status !== "ready") return;
      const config = validateConfig(
        await unseal<RoomConfig>(
          session.key,
          raw.config,
          `${session.accessHash}:config`,
        ),
      );
      const participants = await Promise.all(
        raw.participants.map(async (member) => {
          let name = "Unreadable name",
            vote: number | null = null;
          try {
            const value = await unseal<unknown>(
              session.key,
              member.name,
              `${session.accessHash}:name:${member.id}`,
            );
            if (typeof value === "string" && value.trim() && value.length <= 32)
              name = value;
          } catch {
            /* Malformed content from one participant must not break the room. */
          }
          if (member.vote !== null) {
            try {
              const value = await unseal<unknown>(
                session.key,
                member.vote,
                `${session.accessHash}:vote:${member.id}:${raw.round}`,
              );
              if (
                typeof value === "number" &&
                Number.isInteger(value) &&
                value >= 0 &&
                value < config.cards.length
              )
                vote = value;
            } catch {
              /* Invalid votes render without a value and are excluded from results. */
            }
          }
          return { ...member, name, vote };
        }),
      );
      const items = await Promise.all(
        raw.items.map(async (item) => {
          try {
            const value = await unseal<{ name: string; url: string }>(
              session.key,
              item.content,
              `${session.accessHash}:item:${item.id}`,
            );
            return { id: item.id, ...validateItem(value) };
          } catch {
            return { id: item.id, name: "Unreadable item", url: "" };
          }
        }),
      );
      const pending = await Promise.all(
        raw.pending.map(async (entry) => {
          try {
            const name = await unseal<unknown>(
              session.key,
              entry.name,
              `${session.accessHash}:name:${entry.id}`,
            );
            return {
              id: entry.id,
              name:
                typeof name === "string" && name.trim() && name.length <= 32
                  ? name
                  : "Unreadable name",
            };
          } catch {
            return { id: entry.id, name: "Unreadable name" };
          }
        }),
      );
      if (active) {
        setDecoded({
          source: raw,
          room: { ...raw, config, participants, items, pending },
        });
        setDecodeError(false);
      }
    }
    void decrypt().catch(() => {
      if (active) setDecodeError(true);
    });
    return () => {
      active = false;
    };
  }, [raw, session]);

  const actions: RoomActions = {
    vote: async (index) => {
      if (raw?.status !== "ready") return;
      const round = raw.round;
      const vote =
        index === null
          ? null
          : await seal(
              session.key,
              index,
              `${session.accessHash}:vote:${session.memberId}:${round}`,
            );
      await client.mutation(api.rooms.vote, { ...credentials, round, vote });
    },
    reveal: async () => {
      if (raw?.status === "ready")
        await client.mutation(api.rooms.reveal, {
          ...credentials,
          round: raw.round,
        });
    },
    reset: async () => {
      if (raw?.status === "ready")
        await client.mutation(api.rooms.reset, {
          ...credentials,
          round: raw.round,
        });
    },
    next: async () => {
      if (raw?.status === "ready")
        await client.mutation(api.rooms.nextItem, {
          ...credentials,
          round: raw.round,
        });
    },
    addItem: async (value) => {
      const item = validateItem(value),
        id = crypto.randomUUID();
      await client.mutation(api.rooms.addItem, {
        ...credentials,
        item: {
          id,
          content: await seal(
            session.key,
            item,
            `${session.accessHash}:item:${id}`,
          ),
        },
      });
    },
    removeItem: async (itemId) => {
      await client.mutation(api.rooms.removeItem, { ...credentials, itemId });
    },
    setRole: async (role) => {
      await client.mutation(api.rooms.setRole, { ...credentials, role });
    },
    setLocked: async (locked) => {
      await client.mutation(api.rooms.setLocked, { ...credentials, locked });
    },
    admit: async (memberId, allow) => {
      await client.mutation(api.rooms.admit, {
        ...credentials,
        memberId,
        allow,
      });
    },
    leave: async () => {
      await client.mutation(api.rooms.leave, credentials);
      onExit();
    },
  };
  if (expired || raw === null)
    return (
      <div className="state-screen">
        <Brand />
        <LockKeyhole size={38} />
        <h1>This room is closed.</h1>
      </div>
    );
  if (raw?.status === "pending")
    return (
      <div className="state-screen">
        <Brand />
        <div className="waiting-icon">
          <Clock3 size={35} />
        </div>
        <div className="eyebrow">ONE MOMENT</div>
        <h1>You’re at the door.</h1>
        <p>
          The host will let you in shortly.
          <br />
          Keep this tab open while you wait.
        </p>
        <span className="subtle-pill">
          <span className="status-dot" />{" "}
          {connection.isWebSocketConnected
            ? "Waiting for approval"
            : "Reconnecting…"}
        </span>
        {leaveError && (
          <p role="alert" className="form-error">
            {leaveError}
          </p>
        )}
        <button
          className="button ghost"
          onClick={() => {
            void actions
              .leave()
              .catch(() =>
                setLeaveError(
                  "Couldn’t cancel your request. Please try again.",
                ),
              );
          }}
        >
          Cancel request
        </button>
      </div>
    );
  if (decodeError)
    return (
      <div className="state-screen">
        <Brand />
        <h1>We couldn’t open this room.</h1>
        <p>The room data couldn’t be decrypted with this invitation.</p>
        <button className="button primary" onClick={() => onExit()}>
          Back to the start
        </button>
      </div>
    );
  if (!decoded)
    return (
      <div className="state-screen">
        <Brand />
        <div className="loading-ring" />
        <p>Opening your room…</p>
      </div>
    );
  return (
    <RoomView
      room={decoded.room}
      memberId={session.memberId}
      code={session.code}
      actions={actions}
      connected={connection.isWebSocketConnected && decoded.source === raw}
    />
  );
}
