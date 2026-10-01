import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  ...(process.env.NGT_WEB_MONITORING === 'enabled' ? { testMatch: '**/observability.spec.ts' } : { testIgnore: '**/observability.spec.ts' }),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: { baseURL: process.env.NGT_WEB_TEST_URL, trace: 'off', screenshot: 'off', video: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
