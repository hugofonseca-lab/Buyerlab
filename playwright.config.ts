import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
    launchOptions: process.env["CHROME_PATH"] ? { executablePath: process.env["CHROME_PATH"] } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // --env-file-if-exists carrega DATABASE_URL do .env; as chaves de IA não são necessárias
    // aqui porque BUYERLAB_PROVIDER=mock abaixo já força o modo mock.
    command: "node --env-file-if-exists=.env .output/server/index.mjs",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env["CI"],
    env: {
      PORT: "8080",
      BUYERLAB_PROVIDER: "mock",
      BUYERLAB_DB_SCHEMA: "e2e",
      BUYERLAB_MARKET_PROVIDER: "static",
    },
  },
});
