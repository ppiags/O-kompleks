import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    // Отдельный детерминированный порт: E2E никогда не переиспользуют чужой dev server.
    baseURL: 'http://localhost:4317',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 4317 --strictPort',
    url: 'http://localhost:4317',
    // E2E всегда поднимают собственный сервер в mock-режиме:
    // не зависят ни от .env, ни от уже запущенного dev server, ни от внешних LLM API.
    env: { AI_PROVIDER: 'mock' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
