// Room secrets are generated and kept in browser memory, never in web storage.
import { wordlist } from "@scure/bip39/wordlists/english.js";
const words = new Set(wordlist);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type AccessMode = "link" | "passphrase";
export function generateRoomCode(mode: AccessMode = "link"): string {
  if (mode === "link") return generateToken();
  // 12 independent uniform draws from 2,048 words: 132 bits of entropy.
  // Masking is unbiased because 2,048 evenly divides 65,536.
  return Array.from(
    crypto.getRandomValues(new Uint16Array(12)),
    (value) => wordlist[value & 2047],
  ).join(" ");
}

export function normalizeRoomCode(input: string): string {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      value =
        new URLSearchParams(new URL(value).hash.slice(1)).get("room") ?? "";
    } catch {
      throw new Error("Paste a room code or a complete invitation link.");
    }
  }
  value = value
    .toLowerCase()
    .replace(/[\s-]+/g, " ")
    .trim();
  if (/^[a-f0-9]{64}$/.test(value)) return value;
  const parts = value.split(" ");
  if (parts.length === 12 && parts.every((part) => words.has(part)))
    return value;
  throw new Error(
    "Paste the full invitation link or all 12 words of the passphrase.",
  );
}

export function formatRoomCode(code: string): string {
  return normalizeRoomCode(code);
}
export function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function sha256(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function roomAccessHash(code: string) {
  return sha256(`quorum:room:v1:${normalizeRoomCode(code)}`);
}
export async function roomEncryptionKey(code: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(normalizeRoomCode(code)),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("quorum:v1"),
      info: encoder.encode("room-content"),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
export async function seal(
  key: CryptoKey,
  value: unknown,
  context: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // Fixed-size encrypted envelopes avoid leaking vote/name lengths to the backend.
  const payload = encoder.encode(JSON.stringify(value));
  if (payload.length > 2046)
    throw new Error("That content is too long for a room.");
  const padded = new Uint8Array(2048);
  new DataView(padded.buffer).setUint16(0, payload.length);
  padded.set(payload, 2);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    key,
    padded,
  );
  return `v1.${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}
export async function unseal<T>(
  key: CryptoKey,
  value: string,
  context: string,
): Promise<T> {
  const [version, iv, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !ciphertext)
    throw new Error("Invalid encrypted content.");
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decode(iv),
      additionalData: encoder.encode(context),
    },
    key,
    decode(ciphertext),
  );
  if (plaintext.byteLength !== 2048)
    throw new Error("Invalid encrypted content.");
  const length = new DataView(plaintext).getUint16(0);
  if (length > 2046) throw new Error("Invalid encrypted content.");
  return JSON.parse(decoder.decode(new Uint8Array(plaintext, 2, length))) as T;
}
