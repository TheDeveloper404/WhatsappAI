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

test.describe('Pagina WhatsApp Connect', () => {
  test('pagina se încarcă cu titlul corect', async ({ page }) => {
    await createUser({ email: 'wa@example.com', withSubscription: true })
    await loginAndGoTo(page, 'wa@example.com', '/connect')

    await expect(page.getByRole('heading', { name: /conectare whatsapp/i })).toBeVisible()
  })

  test('butonul de conectare/generare QR există', async ({ page }) => {
    await createUser({ email: 'wabt@example.com', withSubscription: true })
    await loginAndGoTo(page, 'wabt@example.com', '/connect')

    // Butonul "Generează cod QR" sau "Conectat" dacă deja conectat
    const connectBtn = page.getByRole('button', { name: /generează cod qr|conectează|obține cod/i })
    const hasButton = await connectBtn.count() > 0
    // Sau există deja un QR/SVG
    const hasSvg = await page.locator('svg, canvas').count() > 0
    expect(hasButton || hasSvg).toBeTruthy()
  })

  test('starea inițială — butonul de conectare vizibil', async ({ page }) => {
    await createUser({ email: 'wast@example.com', withSubscription: true })
    await loginAndGoTo(page, 'wast@example.com', '/connect')

    // Butonul "Generează cod QR" e vizibil când nu e conectat
    await expect(page.getByRole('button', { name: /generează cod qr/i })).toBeVisible()
  })
})
