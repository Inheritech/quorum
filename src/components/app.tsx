"use client";
import { useCallback, useEffect, useState } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import {
  generateRoomCode,
  generateToken,
  normalizeRoomCode,
  roomAccessHash,
  roomEncryptionKey,
  seal,
} from "@/lib/crypto";
import { validateConfig } from "@/lib/decks";
import type { Session } from "@/lib/room";
import { Landing, type CreateOptions } from "./landing";
import { LiveRoom } from "./live-room";
import { PracticeRoom } from "./practice-room";
import { Dialog } from "./dialog";

function errorMessage(error: unknown) {
  return error instanceof ConvexError
    ? String(error.data)
    : error instanceof Error
      ? error.message
      : "Couldn’t connect. Please try again.";
}

export function App() {
  const [client, setClient] = useState(() =>
    process.env.NEXT_PUBLIC_CONVEX_URL
      ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL, {
          logger: false,
        })
      : null,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [practice, setPractice] = useState(false);
  const [invite, setInvite] = useState("");
  const [notice, setNotice] = useState("");
  const finishSession = useCallback(
    (reason?: string) => {
      setSession(null);
      setInvite("");
      setNotice(reason ?? "You’ve left the room.");
      // Release the client's cached credentials and encrypted query results too.
      if (client) {
        void client.close();
        setClient(new ConvexReactClient(client.url, { logger: false }));
      }
    },
    [client],
  );
  useEffect(() => {
    const consume = () => {
      const code = new URLSearchParams(window.location.hash.slice(1)).get(
        "room",
      );
      if (code) {
        window.history.replaceState(null, "", window.location.pathname);
        setInvite(code);
      }
    };
    const timer = window.setTimeout(consume, 0);
    window.addEventListener("hashchange", consume);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", consume);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const preventAccidentalExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventAccidentalExit);
    return () =>
      window.removeEventListener("beforeunload", preventAccidentalExit);
  }, [session]);
  async function credentials(code: string): Promise<Session> {
    const normalized = normalizeRoomCode(code);
    return {
      code: normalized,
      key: await roomEncryptionKey(normalized),
      accessHash: await roomAccessHash(normalized),
      token: generateToken(),
      memberId: crypto.randomUUID(),
    };
  }
  async function create(options: CreateOptions) {
    if (!client) throw new Error("Live rooms aren’t available yet.");
    const config = validateConfig(options.config);
    const next = await credentials(generateRoomCode(options.accessMode));
    try {
      await client.mutation(api.rooms.create, {
        accessHash: next.accessHash,
        token: next.token,
        memberId: next.memberId,
        name: await seal(
          next.key,
          options.name,
          `${next.accessHash}:name:${next.memberId}`,
        ),
        config: await seal(next.key, config, `${next.accessHash}:config`),
        ttlHours: options.ttlHours,
        requireApproval: options.requireApproval,
        role: "voter",
      });
      setSession(next);
      setInvite("");
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }
  async function join(code: string, name: string, observer: boolean) {
    if (!client) throw new Error("Live rooms aren’t available yet.");
    const next = await credentials(code);
    try {
      await client.mutation(api.rooms.join, {
        accessHash: next.accessHash,
        token: next.token,
        memberId: next.memberId,
        name: await seal(
          next.key,
          name,
          `${next.accessHash}:name:${next.memberId}`,
        ),
        role: observer ? "observer" : "voter",
      });
      setSession(next);
      setInvite("");
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }
  if (practice) return <PracticeRoom onExit={() => setPractice(false)} />;
  if (session && client)
    return (
      <ConvexProvider client={client}>
        <LiveRoom session={session} onExit={finishSession} />
      </ConvexProvider>
    );
  return (
    <>
      <Landing
        key={invite}
        configured={!!client}
        invite={invite}
        onCreate={create}
        onJoin={join}
        onPractice={() => setPractice(true)}
      />
      {notice && (
        <Dialog title="Back to a clean slate." onClose={() => setNotice("")}>
          <p className="dialog-intro">{notice}</p>
          <button className="button primary full" onClick={() => setNotice("")}>
            Got it
          </button>
        </Dialog>
      )}
    </>
  );
}
