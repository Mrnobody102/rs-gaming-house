import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 40000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3201",
    ...devices["Desktop Chrome"],
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
    screenshot: "only-on-failure",
    actionTimeout: 10000,
    navigationTimeout: 20000,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run start:demo -- --port 3201",
      url: "http://127.0.0.1:3201",
      reuseExistingServer: false,
      env: {
        DEMO_DATA_DIR: `.local/e2e-postgres-${process.pid}`,
        DEMO_MEDIA_DIR: `.local/e2e-media-${process.pid}`,
      },
      timeout: 60000,
    },
    {
      command: "npm start -- --port 3202",
      url: "http://127.0.0.1:3202",
      reuseExistingServer: false,
      env: {
        LOCAL_PREVIEW: "0",
        ADMIN_PASSCODE: "",
        ADMIN_SESSION_SECRET: "",
        DEMO_DATA_DIR: `.local/e2e-setup-${process.pid}`,
        DEMO_MEDIA_DIR: `.local/e2e-setup-media-${process.pid}`,
      },
      timeout: 60000,
    },
  ],
});
