import { defineConfig, devices } from '@playwright/test';

const external = process.env.E2E_BASE_URL;
const channel = process.env.PW_CHANNEL ?? 'chrome';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: external ?? 'http://localhost:3000' },
  webServer: external
    ? undefined
    : { command: 'npm run build && npm run start', url: 'http://localhost:3000', timeout: 240_000, reuseExistingServer: true },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], channel } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel } },
  ],
});
