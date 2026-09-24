import { describe, expect, it } from "vitest";
import {
  generateRoomCode,
  generateToken,
  normalizeRoomCode,
  roomAccessHash,
  roomEncryptionKey,
  seal,
  unseal,
} from "../src/lib/crypto";
import { assertCiphertext } from "../convex/lib";

describe("room invitation secrets", () => {
  it("makes 256-bit links and independently sampled 132-bit word passphrases", () => {
    const links = new Set(
      Array.from({ length: 50 }, () => generateRoomCode("link")),
    );
    expect(links.size).toBe(50);
    for (const code of links) expect(code).toMatch(/^[a-f0-9]{64}$/);
    const phrases = new Set(
      Array.from({ length: 50 }, () => generateRoomCode("passphrase")),
    );
    expect(phrases.size).toBe(50);
    for (const phrase of phrases) {
      expect(phrase.split(" ")).toHaveLength(12);
      expect(normalizeRoomCode(phrase)).toBe(phrase);
    }
  });
  it("accepts complete invitation links and normalizes word separators", () => {
    const phrase = generateRoomCode("passphrase");
    expect(
      normalizeRoomCode(
        `https://quorum.example/#room=${encodeURIComponent(phrase)}`,
      ),
    ).toBe(phrase);
    expect(normalizeRoomCode(phrase.toUpperCase().replaceAll(" ", "-"))).toBe(
      phrase,
    );
    const code = generateRoomCode();
    expect(normalizeRoomCode(`https://quorum.example/#room=${code}`)).toBe(
      code,
    );
  });
  it.each([
    "password",
    "a".repeat(63),
    "aaaa ".repeat(12),
    "https://example.com/?room=secret",
    "javascript:alert(1)",
  ])("rejects malformed or short credentials: %s", (input) => {
    expect(() => normalizeRoomCode(input)).toThrow();
  });
});

describe("end-to-end content encryption", () => {
  it("independently joined clients decrypt, while the server's lookup hash cannot", async () => {
    const code = generateRoomCode();
    const sender = await roomEncryptionKey(code),
      receiver = await roomEncryptionKey(code);
    const lookupHash = await roomAccessHash(code);
    const content = {
      name: "Secret payroll refactor",
      url: "https://internal.example/HR-17",
    };
    const ciphertext = await seal(sender, content, `${lookupHash}:item:123`);
    expect(ciphertext).not.toContain(content.name);
    expect(ciphertext).not.toContain(content.url);
    expect(ciphertext).not.toContain(code);
    expect(
      await unseal(receiver, ciphertext, `${lookupHash}:item:123`),
    ).toEqual(content);
    const backendOnly = await roomEncryptionKey(lookupHash);
    await expect(
      unseal(backendOnly, ciphertext, `${lookupHash}:item:123`),
    ).rejects.toThrow();
    expect(sender.extractable).toBe(false);
  });
  it("uses fresh IVs and pads different values to the same envelope length", async () => {
    const key = await roomEncryptionKey(generateRoomCode());
    const first = await seal(key, 1, "vote"),
      second = await seal(key, 1, "vote"),
      long = await seal(key, { name: "x".repeat(160) }, "item");
    expect(first).not.toBe(second);
    expect(first.length).toBe(long.length);
    expect(() => assertCiphertext(first)).not.toThrow();
    expect(() => assertCiphertext(long)).not.toThrow();
  });
  it("rejects changed ciphertext, wrong keys, wrong participants, and replay into another round", async () => {
    const key = await roomEncryptionKey(generateRoomCode()),
      other = await roomEncryptionKey(generateRoomCode());
    const encrypted = await seal(key, 4, "room:vote:alice:1");
    await expect(
      unseal(other, encrypted, "room:vote:alice:1"),
    ).rejects.toThrow();
    await expect(unseal(key, encrypted, "room:vote:bob:1")).rejects.toThrow();
    await expect(unseal(key, encrypted, "room:vote:alice:2")).rejects.toThrow();
    const tampered =
      encrypted.slice(0, -10) +
      (encrypted.at(-10) === "A" ? "B" : "A") +
      encrypted.slice(-9);
    await expect(unseal(key, tampered, "room:vote:alice:1")).rejects.toThrow();
  });
  it("bounds payloads and rejects unencrypted content", async () => {
    const key = await roomEncryptionKey(generateRoomCode());
    await expect(seal(key, "x".repeat(2048), "content")).rejects.toThrow(
      "too long",
    );
    expect(() => assertCiphertext("plain text")).toThrow();
    expect(generateToken()).toHaveLength(64);
  });
});
