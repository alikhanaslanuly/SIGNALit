import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.e2e.ts', fullyParallel: false, workers: 1, timeout: 45000,
  expect: { timeout: 10000 }, reporter: 'list',
  use: { channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', baseURL: 'http://127.0.0.1:5180', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run server:dev', url: 'http://127.0.0.1:4610/health', env: { PORT: '4610', SIGNAL_DB_PATH: ':memory:', FRONTEND_ORIGIN: 'http://127.0.0.1:5180,http://127.0.0.1:5181' }, reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5180 --strictPort', url: 'http://127.0.0.1:5180', env: { VITE_API_URL: 'http://127.0.0.1:4610' }, reuseExistingServer: false },
    { command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5181 --strictPort', url: 'http://127.0.0.1:5181', env: { VITE_API_URL: 'http://127.0.0.1:4610', SIGNAL_ALLOW_LOCAL_API: '1' }, reuseExistingServer: false },
  ],
});
