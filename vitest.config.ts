import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { BUYERLAB_MARKET_PROVIDER: "static" },
    // Store agora fala com Postgres real (Supabase); cada teste cria/migra/derruba seu próprio
    // schema, então o padrão de 5s do Vitest é curto demais para latência de rede real.
    testTimeout: 180000,
    hookTimeout: 60000,
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
