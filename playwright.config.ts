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
    command: "node .output/server/index.mjs",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env["CI"],
    env: {
      PORT: "8080",
      BUYERLAB_PROVIDER: "mock",
      BUYERLAB_DB_PATH: ".data/e2e.sqlite",
      BUYERLAB_MARKET_PROVIDER: "static",
    },
  },
});
