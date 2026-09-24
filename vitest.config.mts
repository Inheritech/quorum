import { defineConfig } from "vitest/config";
// All persistence in convex-test is isolated in memory.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    server: { deps: { inline: ["convex-test"] } },
  },
});
