export const DECKS = {
  fibonacci: {
    name: "Story points",
    description: "Fibonacci · a little room for uncertainty",
    cards: ["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"],
  },
  tshirt: {
    name: "T-shirt sizes",
    description: "Relative effort, from XS to XXL",
    cards: ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"],
  },
  hours: {
    name: "Hours",
    description: "Time estimates, from a half hour to a week",
    cards: ["0.5", "1", "2", "4", "8", "16", "24", "40", "?", "☕"],
  },
} as const;
export type DeckKind = keyof typeof DECKS | "custom";
export type RoomConfig = { name: string; deck: DeckKind; cards: string[] };

export function parseCustomDeck(value: string): string[] {
  const cards = value.split(",").map((card) => card.trim());
  if (
    cards.length < 2 ||
    cards.length > 16 ||
    cards.some((card) => !card || card.length > 8)
  ) {
    throw new Error(
      "Use 2–16 comma-separated cards, with 1–8 characters each.",
    );
  }
  if (new Set(cards).size !== cards.length)
    throw new Error("Give each card a different value.");
  return cards;
}

export function validateConfig(value: unknown): RoomConfig {
  if (!value || typeof value !== "object")
    throw new Error("This room’s settings could not be read.");
  const config = value as RoomConfig;
  if (
    typeof config.name !== "string" ||
    !config.name.trim() ||
    config.name.length > 80 ||
    !["fibonacci", "tshirt", "hours", "custom"].includes(config.deck) ||
    !Array.isArray(config.cards) ||
    config.cards.length < 2 ||
    config.cards.length > 16 ||
    config.cards.some(
      (card) => typeof card !== "string" || !card.trim() || card.length > 8,
    ) ||
    new Set(config.cards).size !== config.cards.length
  )
    throw new Error("This room’s settings are invalid.");
  return config;
}

export function summarizeVotes(cards: string[], votes: (number | null)[]) {
  const values = votes.filter(
    (vote): vote is number => vote !== null && vote >= 0 && vote < cards.length,
  );
  const counts = cards.map((card, index) => ({
    card,
    count: values.filter((value) => value === index).length,
  }));
  const estimates = values
    .map((vote) => cards[vote])
    .filter((card) => card !== "?" && card !== "☕");
  const numbers = estimates.map(Number);
  const numeric =
    numbers.length > 0 && numbers.every((value) => Number.isFinite(value));
  return {
    counts,
    total: values.length,
    average: numeric
      ? (numbers.reduce((a, b) => a + b, 0) / numbers.length)
          .toFixed(1)
          .replace(/\.0$/, "")
      : null,
    consensus: estimates.length > 0 && new Set(estimates).size === 1,
    agreement: estimates.length
      ? Math.round(
          (Math.max(
            ...counts
              .filter(({ card }) => card !== "?" && card !== "☕")
              .map(({ count }) => count),
          ) /
            estimates.length) *
            100,
        )
      : 0,
  };
}
