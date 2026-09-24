"use client";
import { useState } from "react";
import { DECKS } from "@/lib/decks";
import { validateItem } from "@/lib/items";
import type { Room, RoomActions } from "@/lib/room";
import { RoomView } from "./room-view";

export function PracticeRoom({ onExit }: { onExit: () => void }) {
  const [room, setRoom] = useState<Room>(() => ({
    config: {
      name: "The next good thing",
      deck: "fibonacci",
      cards: [...DECKS.fibonacci.cards],
    },
    hostId: "you",
    round: 1,
    revealed: false,
    locked: false,
    expiresAt: Date.now() + 2 * 3_600_000,
    requireApproval: true,
    participants: [
      {
        id: "you",
        name: "You",
        role: "voter",
        vote: null,
        hasVoted: false,
        lastSeen: Date.now(),
      },
      {
        id: "alex",
        name: "Alex",
        role: "voter",
        vote: null,
        hasVoted: true,
        lastSeen: Date.now(),
      },
      {
        id: "jo",
        name: "Jo",
        role: "voter",
        vote: null,
        hasVoted: true,
        lastSeen: Date.now(),
      },
      {
        id: "sam",
        name: "Sam",
        role: "voter",
        vote: null,
        hasVoted: true,
        lastSeen: Date.now(),
      },
      {
        id: "riley",
        name: "Riley",
        role: "observer",
        vote: null,
        hasVoted: false,
        lastSeen: Date.now(),
      },
    ],
    pending: [{ id: "casey", name: "Casey" }],
    items: [
      {
        id: "item-1",
        name: "Make onboarding feel like a warm welcome",
        url: "",
      },
      {
        id: "item-2",
        name: "Add keyboard shortcuts to search",
        url: "https://example.com/issues/42",
      },
      { id: "item-3", name: "Give empty states a little personality", url: "" },
    ],
  }));
  const restart = (next: boolean) =>
    setRoom((current) => ({
      ...current,
      round: current.round + 1,
      revealed: false,
      items: next ? current.items.slice(1) : current.items,
      participants: current.participants.map((member) => ({
        ...member,
        vote: null,
        hasVoted: member.id !== "you" && member.role === "voter",
      })),
    }));
  const actions: RoomActions = {
    vote: async (vote) =>
      setRoom((current) => ({
        ...current,
        participants: current.participants.map((member) =>
          member.id === "you"
            ? { ...member, vote, hasVoted: vote !== null }
            : member,
        ),
      })),
    reveal: async () =>
      setRoom((current) => ({
        ...current,
        revealed: true,
        participants: current.participants.map((member, index) =>
          member.id !== "you" && member.role === "voter" && member.hasVoted
            ? { ...member, vote: index === 3 ? 5 : 4 }
            : member,
        ),
      })),
    reset: async () => restart(false),
    next: async () => restart(true),
    addItem: async (value) => {
      const item = validateItem(value);
      setRoom((current) => ({
        ...current,
        items: [...current.items, { id: crypto.randomUUID(), ...item }],
      }));
    },
    removeItem: async (id) =>
      setRoom((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== id),
      })),
    setRole: async (role) =>
      setRoom((current) => ({
        ...current,
        participants: current.participants.map((member) =>
          member.id === "you"
            ? { ...member, role, vote: null, hasVoted: false }
            : member,
        ),
      })),
    setLocked: async (locked) => setRoom((current) => ({ ...current, locked })),
    admit: async (id, allow) =>
      setRoom((current) => ({
        ...current,
        pending: current.pending.filter((entry) => entry.id !== id),
        participants: allow
          ? [
              ...current.participants,
              {
                id,
                name: "Casey",
                role: "voter",
                vote: null,
                hasVoted: false,
                lastSeen: Date.now(),
              },
            ]
          : current.participants,
      })),
    leave: async () => onExit(),
  };
  return (
    <RoomView
      room={room}
      memberId="you"
      code=""
      actions={actions}
      connected
      practice
    />
  );
}
