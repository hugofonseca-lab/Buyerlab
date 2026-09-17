import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { BUYERLAB_MARKET_PROVIDER: "static" },
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
