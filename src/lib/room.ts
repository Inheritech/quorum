import type { RoomConfig } from "./decks";
import type { QueueItem } from "./items";

export type Session = {
  code: string;
  key: CryptoKey;
  accessHash: string;
  token: string;
  memberId: string;
  expiresAt: number;
  recoverUntil: number;
  recoveryAvailable?: boolean;
};
export type Member = {
  id: string;
  name: string;
  role: "voter" | "observer";
  vote: number | null;
  hasVoted: boolean;
  lastSeen: number;
};
export type Room = {
  config: RoomConfig;
  hostId: string;
  hostChangedAt: number | null;
  round: number;
  revealed: boolean;
  locked: boolean;
  expiresAt: number;
  requireApproval: boolean;
  participants: Member[];
  pending: { id: string; name: string }[];
  items: QueueItem[];
};
export type RoomActions = {
  vote: (index: number | null) => Promise<void>;
  reveal: () => Promise<void>;
  reset: () => Promise<void>;
  next: () => Promise<void>;
  addItem: (item: { name: string; url: string }) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setRole: (role: "voter" | "observer") => Promise<void>;
  setLocked: (locked: boolean) => Promise<void>;
  admit: (id: string, allow: boolean) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  leave: () => Promise<void>;
};
