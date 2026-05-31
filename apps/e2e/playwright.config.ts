import { defineConfig, devices } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Browser-ele sunt instalate în d:\playwright-browsers (custom path folosit la instalare)
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = 'd:\\playwright-browsers'
}

// Citim ADMIN_SECRET real din .env-ul API-ului, ca să funcționeze și cu reuseExistingServer
function readApiAdminSecret(): string {
  try {
    const envPath = path.join(__dirname, '../api/.env')
    const content = fs.readFileSync(envPath, 'utf-8')
    const match = content.match(/^ADMIN_SECRET=(.+)$/m)
    return match?.[1]?.trim() ?? 'test_admin_secret_minimum_32_chars_here'
  } catch {
    return 'test_admin_secret_minimum_32_chars_here'
  }
}

const E2E_ADMIN_SECRET = process.env.E2E_ADMIN_SECRET ?? readApiAdminSecret()
process.env.E2E_ADMIN_SECRET = E2E_ADMIN_SECRET

// Rutele de test (/api/v1/test/*) cer header x-e2e-secret == env.E2E_SECRET pe API.
// Citim valoarea din .env-ul API-ului și o expunem ȘI procesului de teste (pentru
// helperii din helpers/api.ts), ca să nu primim 401 la resetDb()/createUser().
function readApiE2eSecret(): string {
  try {
    const envPath = path.join(__dirname, '../api/.env')
    const content = fs.readFileSync(envPath, 'utf-8')
    const match = content.match(/^E2E_SECRET=(.+)$/m)
    return match?.[1]?.trim() ?? ''
  } catch {
    return ''
  }
}

const E2E_SECRET = process.env.E2E_SECRET ?? readApiE2eSecret()
process.env.E2E_SECRET = E2E_SECRET

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'npx tsx src/index.ts',
      cwd: '../api',
      url: 'http://localhost:3001/health',
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        E2E_MODE: 'true',
        E2E_SECRET,
        DATABASE_URL: 'postgresql://localhost/whatsapp_ai_e2e',
        ADMIN_SECRET: E2E_ADMIN_SECRET,
      },
    },
    {
      command: 'npx next dev --port 3000',
      cwd: '../web',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
