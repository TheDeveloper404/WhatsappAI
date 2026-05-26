import { test, expect } from '@playwright/test'
import { resetDb, createUser, DEFAULT_PASSWORD } from '../helpers/api.js'

test.beforeEach(async ({ page }) => {
  await resetDb()
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})
})

async function loginAndGoTo(page: any, email: string, path: string) {
  await page.goto('/login')
  await page.getByLabel(/^email$/i).fill(email)
  await page.getByLabel(/^parolă$/i).fill(DEFAULT_PASSWORD)
  await page.getByRole('button', { name: /intră în cont|autentifică|login/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await page.goto(path)
}

test.describe('Pagina Conversații', () => {
  test('se încarcă și afișează stare goală', async ({ page }) => {
    await createUser({ email: 'conv@example.com', withSubscription: true })
    await loginAndGoTo(page, 'conv@example.com', '/conversations')

    await expect(page.getByRole('heading', { name: /conversații/i })).toBeVisible()
    // Empty state — agentul nu a salvat nicio conversație
    await expect(page.getByText(/nicio conversație|niciun mesaj/i).first()).toBeVisible()
  })

  test('butonul de refresh există și funcționează', async ({ page }) => {
    await createUser({ email: 'convref@example.com', withSubscription: true })
    await loginAndGoTo(page, 'convref@example.com', '/conversations')

    const refreshBtn = page.locator('button[title="Reîncarcă"]')
    await expect(refreshBtn).toBeVisible()
    await refreshBtn.click()
    await expect(page.getByText(/nicio conversație|niciun mesaj/i).first()).toBeVisible()
  })

  test('subtitlul arată starea goală', async ({ page }) => {
    await createUser({ email: 'convcount@example.com', withSubscription: true })
    await loginAndGoTo(page, 'convcount@example.com', '/conversations')

    // Subtitlul afișează "Nicio conversație salvată încă." când nu sunt conversații
    await expect(page.getByText(/Nicio conversație salvată/i)).toBeVisible()
  })
})
