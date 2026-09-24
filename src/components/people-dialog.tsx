"use client";
import { useEffect, useRef, useState } from "react";
import { ConvexError } from "convex/values";
import { Crown, UserMinus } from "lucide-react";
import type { Room, RoomActions } from "@/lib/room";
import { AWAY_AFTER_MS } from "@/lib/presence";
import { Dialog } from "./dialog";

export function PeopleDialog({
  room,
  memberId,
  actions,
  connected,
  practice,
  now,
  onClose,
}: {
  room: Room;
  memberId: string;
  actions: RoomActions;
  connected: boolean;
  practice: boolean;
  now: number;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const focus = useRef<HTMLButtonElement>(null);
  const person = room.participants.find((entry) => entry.id === target);
  const isHost = room.hostId === memberId;
  useEffect(() => {
    focus.current?.focus();
  }, [target, person?.id]);
  async function remove() {
    if (!person) return;
    setBusy(true);
    setError("");
    try {
      await actions.removeMember(person.id);
      setNotice(`${person.name} was removed.`);
      setTarget(null);
    } catch (error) {
      setError(
        error instanceof ConvexError
          ? String(error.data)
          : "Couldn’t remove this person. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        person && isHost ? `Remove ${person.name}?` : "People in this room"
      }
      onClose={onClose}
    >
      {person && isHost ? (
        <>
          <p className="dialog-intro">
            Their name and vote will be removed, and this session won’t be
            recoverable. They can request access again with the invitation.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              ref={focus}
              onClick={() => setTarget(null)}
            >
              Keep in room
            </button>
            <button
              className="button danger"
              disabled={busy || !connected}
              onClick={() => void remove()}
            >
              <UserMinus size={16} /> Remove person
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="dialog-intro">
            {practice
              ? "Sample participants for trying out your room."
              : "A brief connection loss keeps your place for up to two minutes. If the host disconnects longer, the longest-present person becomes host."}
          </p>
          <ul className="people-list">
            {room.participants.map((member) => (
              <li key={member.id}>
                <div>
                  <strong>
                    {member.name}
                    {member.id === memberId ? " (you)" : ""}
                  </strong>
                  <span>
                    {member.id === room.hostId && (
                      <>
                        <Crown size={13} /> Host ·{" "}
                      </>
                    )}
                    {member.role === "observer" ? "Observing" : "Voting"}
                    {!practice && now - member.lastSeen > AWAY_AFTER_MS
                      ? " · Reconnecting…"
                      : ""}
                  </span>
                </div>
                {isHost && member.id !== memberId && (
                  <button
                    className="button small secondary"
                    disabled={busy || !connected}
                    aria-label={`Remove ${member.name}`}
                    onClick={() => {
                      setError("");
                      setTarget(member.id);
                    }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            className="button secondary full"
            ref={focus}
            onClick={onClose}
          >
            Done
          </button>
        </>
      )}
      <p role="status" className="form-footnote">
        {notice}
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </Dialog>
  );
}
