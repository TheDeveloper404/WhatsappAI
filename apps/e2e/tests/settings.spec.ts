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

test.describe('Pagina Setări', () => {
  test('pagina se încarcă cu toate secțiunile', async ({ page }) => {
    await createUser({ email: 'settings@example.com', withSubscription: true })
    await loginAndGoTo(page, 'settings@example.com', '/settings')

    // Tab Agent (implicit)
    await expect(page.getByText(/Stare agent/i)).toBeVisible()
    await expect(page.getByText(/Timer inactivitate/i)).toBeVisible()

    // Tab Conținut → System prompt
    await page.getByRole('button', { name: /^Conținut$/i }).click()
    await expect(page.getByText(/System prompt/i)).toBeVisible()

    // Tab Control → Contacte ignorate
    await page.getByRole('button', { name: /^Control$/i }).click()
    await expect(page.getByText(/Contacte ignorate/i)).toBeVisible()
  })

  test('toggle AI activează agentul', async ({ page }) => {
    await createUser({ email: 'settoggle@example.com', withSubscription: true })
    await loginAndGoTo(page, 'settoggle@example.com', '/settings')

    await expect(page.getByText(/agentul este inactiv/i)).toBeVisible()
    const toggleBtn = page.locator('button[class*="rounded-full"]').first()
    await toggleBtn.click()
    await expect(page.getByText(/agentul este activ/i)).toBeVisible()
  })

  test('schimbă timer și salvează', async ({ page }) => {
    await createUser({ email: 'timer@example.com', withSubscription: true })
    await loginAndGoTo(page, 'timer@example.com', '/settings')

    const timerInput = page.locator('input[type="number"]')
    await timerInput.fill('15')
    await page.getByRole('button', { name: /salvează/i }).first().click()
    await expect(page.getByText(/Salvat!/i)).toBeVisible()
  })

  test('editează system prompt și salvează', async ({ page }) => {
    await createUser({ email: 'prompt@example.com', withSubscription: true })
    await loginAndGoTo(page, 'prompt@example.com', '/settings')

    await page.getByRole('button', { name: /^Conținut$/i }).click()
    const textarea = page.locator('textarea').first()
    await textarea.fill('Ești un asistent prietenos care răspunde în română și ajută clienții.')
    await page.getByRole('button', { name: /Salvează promptul/i }).click()
    await expect(page.getByText(/Salvat!/i)).toBeVisible()
  })

  test('adaugă număr în blacklist și apare în listă', async ({ page }) => {
    await createUser({ email: 'bl@example.com', withSubscription: true })
    await loginAndGoTo(page, 'bl@example.com', '/settings')

    await page.getByRole('button', { name: /^Control$/i }).click()
    const phoneInput = page.locator('input[placeholder*="ex"]')
    await phoneInput.fill('40758154490')
    await page.getByRole('button', { name: /Adaugă/i }).click()

    await expect(page.getByText('+40758154490')).toBeVisible()
  })

  test('număr prea scurt → eroare de validare', async ({ page }) => {
    await createUser({ email: 'blshort@example.com', withSubscription: true })
    await loginAndGoTo(page, 'blshort@example.com', '/settings')

    await page.getByRole('button', { name: /^Control$/i }).click()
    const phoneInput = page.locator('input[placeholder*="ex"]')
    await phoneInput.fill('123')
    await page.getByRole('button', { name: /Adaugă/i }).click()

    await expect(page.getByText(/Număr prea scurt/i)).toBeVisible()
  })

  test('șterge număr din blacklist', async ({ page }) => {
    await createUser({ email: 'bldelete@example.com', withSubscription: true })
    await loginAndGoTo(page, 'bldelete@example.com', '/settings')

    await page.getByRole('button', { name: /^Control$/i }).click()
    // Adaugă
    const phoneInput = page.locator('input[placeholder*="ex"]')
    await phoneInput.fill('40712345678')
    await page.getByRole('button', { name: /Adaugă/i }).click()
    await expect(page.getByText('+40712345678')).toBeVisible()

    // Șterge
    await page.locator('button[title="Șterge"]').click()
    await expect(page.getByText('+40712345678')).not.toBeVisible()
  })

  test('Enter în câmpul telefon adaugă numărul', async ({ page }) => {
    await createUser({ email: 'blenter@example.com', withSubscription: true })
    await loginAndGoTo(page, 'blenter@example.com', '/settings')

    await page.getByRole('button', { name: /^Control$/i }).click()
    const phoneInput = page.locator('input[placeholder*="ex"]')
    await phoneInput.fill('40798765432')
    await phoneInput.press('Enter')
    await expect(page.getByText('+40798765432')).toBeVisible()
  })
})
