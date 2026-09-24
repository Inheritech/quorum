import { describe, expect, it } from "vitest";
import {
  parseCustomDeck,
  summarizeVotes,
  validateConfig,
} from "../src/lib/decks";
import { validateItem } from "../src/lib/items";

describe("custom decks and results", () => {
  it("accepts small numeric and nonnumeric decks and rejects ambiguity", () => {
    expect(parseCustomDeck(" XS, S, M, L ")).toEqual(["XS", "S", "M", "L"]);
    for (const value of [
      "1",
      "1,1",
      "1,,2",
      "123456789,2",
      Array.from({ length: 17 }, (_, i) => i).join(","),
    ])
      expect(() => parseCustomDeck(value)).toThrow();
    expect(() =>
      validateConfig({ name: "", deck: "hours", cards: ["1", "2"] }),
    ).toThrow();
  });
  it("excludes abstentions and coffee from numeric results, without making sizes into numbers", () => {
    expect(
      summarizeVotes(["3", "5", "?", "☕"], [0, 1, 2, 3, null]),
    ).toMatchObject({
      average: "4",
      consensus: false,
      agreement: 50,
      total: 4,
    });
    expect(summarizeVotes(["S", "M", "?"], [1, 1, 2])).toMatchObject({
      average: null,
      consensus: true,
      agreement: 100,
    });
    expect(summarizeVotes(["1", "?"], [null, 1])).toMatchObject({
      average: null,
      consensus: false,
      agreement: 0,
    });
    expect(summarizeVotes(["1", "2"], [])).toMatchObject({
      average: null,
      agreement: 0,
    });
  });
});

describe("queue items", () => {
  it("only needs a name and optionally accepts an ordinary web link", () => {
    expect(validateItem({ name: " Build a better form ", url: "" })).toEqual({
      name: "Build a better form",
      url: "",
    });
    expect(
      validateItem({
        name: "Private ticket",
        url: "https://jira.internal/browse/ABC-1",
      }).url,
    ).toContain("ABC-1");
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///secret",
    "https://user:password@example.com",
    "not a link",
  ])("rejects unsafe link %s", (url) => {
    expect(() => validateItem({ name: "Ticket", url })).toThrow();
  });
  it("requires a bounded name", () => {
    expect(() => validateItem({ name: "  ", url: "" })).toThrow();
    expect(() => validateItem({ name: "x".repeat(161), url: "" })).toThrow();
  });
});
