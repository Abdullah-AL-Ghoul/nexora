import { defineConfig } from "@playwright/test";

/**
 * E2E suite. Runs the dev server on port 3100 (so a production server on
 * 3000 is never disturbed) with NEXORA_MOCK_PAY=1 so the local mock payment
 * flow can complete checkout without Stripe keys.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100",
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      // Align the app URL with the test origin so better-auth's
      // trustedOrigins check accepts sign-in requests from :3100.
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
      BETTER_AUTH_URL: "http://localhost:3100",
    },
  },
});
