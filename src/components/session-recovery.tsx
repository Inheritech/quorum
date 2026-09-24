"use client";
import { useEffect, useRef, useState } from "react";
import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";
import { recoverSession, type StoredSession } from "@/lib/session-recovery";
import type { Session } from "@/lib/room";
import { Brand } from "./brand";

export function SessionRecovery({
  client,
  record,
  onRecovered,
  onExit,
}: {
  client: ConvexReactClient;
  record: StoredSession;
  onRecovered: (session: Session) => void;
  onExit: (reason: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const cancel = useRef(() => {});
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(
      () => {
        if (!active) return;
        active = false;
        onExit(
          "The reconnect window has ended. Use your invitation to join again.",
        );
      },
      Math.max(0, record.recoverUntil - Date.now()),
    );
    cancel.current = () => {
      active = false;
      window.clearTimeout(timer);
    };
    void recoverSession(record, (credentials) =>
      client.mutation(api.rooms.heartbeat, credentials),
    )
      .then((session) => {
        if (!active) return;
        active = false;
        window.clearTimeout(timer);
        if (session) onRecovered(session);
        else
          onExit(
            "Your previous session is no longer available. Use your invitation to request access again.",
          );
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [client, record, onRecovered, onExit, attempt]);
  return (
    <main className="state-screen">
      <Brand />
      <h1>{failed ? "Let’s reconnect." : "Returning to your room…"}</h1>
      <p role="status">
        {failed
          ? "Check your connection and try again while your session is still available."
          : "Restoring your name, role, and place in the room."}
      </p>
      {failed && (
        <button
          className="button primary"
          onClick={() => {
            setFailed(false);
            setAttempt(attempt + 1);
          }}
        >
          Try again
        </button>
      )}
      <button
        className="button ghost"
        onClick={() => {
          cancel.current();
          onExit(
            "Your saved session has been cleared. You can join again with the invitation.",
          );
        }}
      >
        Forget this session
      </button>
    </main>
  );
}
