import { test, expect } from '@playwright/test'
import { resetDb, createUser, activateAgent, DEFAULT_PASSWORD } from '../helpers/api.js'

test.beforeEach(async ({ page }) => {
  await resetDb()
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})
})

async function loginAs(page: any, email: string) {
  await page.goto('/login')
  await page.getByLabel(/^email$/i).fill(email)
  await page.getByLabel(/^parolă$/i).fill(DEFAULT_PASSWORD)
  await page.getByRole('button', { name: /intră în cont|autentifică|login/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test.describe('Dashboard', () => {
  test('afișează salutul cu numele userului', async ({ page }) => {
    await createUser({ email: 'dash@example.com', name: 'Alexandru', withSubscription: true })
    await loginAs(page, 'dash@example.com')
    await expect(page.getByText(/Alexandru/)).toBeVisible()
  })

  test('badge subscripție vizibil (Trial activ)', async ({ page }) => {
    await createUser({ email: 'trial@example.com', withSubscription: true })
    await loginAs(page, 'trial@example.com')
    await expect(page.getByText('Trial activ', { exact: true })).toBeVisible()
  })

  test('cardul WhatsApp arată "Neconectat" inițial', async ({ page }) => {
    await createUser({ email: 'wa@example.com', withSubscription: true })
    await loginAs(page, 'wa@example.com')
    await expect(page.getByText(/Neconectat/i)).toBeVisible()
  })

  test('cardul Agent AI arată "Inactiv" inițial', async ({ page }) => {
    await createUser({ email: 'ai@example.com', withSubscription: true })
    await loginAs(page, 'ai@example.com')
    await expect(page.getByText(/Inactiv/i)).toBeVisible()
  })

  test('toggle AI activează agentul și afișează "Activ"', async ({ page }) => {
    await createUser({ email: 'toggle@example.com', withSubscription: true })
    await loginAs(page, 'toggle@example.com')

    // Găsim toggle-ul (button cu rol switch sau button lângă "Agent AI")
    const toggleBtn = page.locator('button[class*="rounded-full"]').first()
    await toggleBtn.click()
    await expect(page.getByText('Activ', { exact: true })).toBeVisible()
  })

  test('toggle AI dezactivează după a doua apăsare', async ({ page }) => {
    const { userId } = await createUser({ email: 'toggle2@example.com', withSubscription: true })
    await activateAgent(userId)
    await loginAs(page, 'toggle2@example.com')

    await expect(page.getByText('Activ', { exact: true })).toBeVisible()
    const toggleBtn = page.locator('button[class*="rounded-full"]').first()
    await toggleBtn.click()
    await expect(page.getByText('Inactiv', { exact: true })).toBeVisible()
  })

  test('pașii următori sunt vizibili', async ({ page }) => {
    await createUser({ email: 'steps@example.com', withSubscription: true })
    await loginAs(page, 'steps@example.com')
    await expect(page.getByText(/Pașii următori/i)).toBeVisible()
    await expect(page.getByText(/Cont creat/i)).toBeVisible()
    await expect(page.getByText(/Conectare WhatsApp/i)).toBeVisible()
  })

  test('butonul "Conectează acum" deschide panoul de conectare WhatsApp', async ({ page }) => {
    await createUser({ email: 'connect@example.com', withSubscription: true })
    await loginAs(page, 'connect@example.com')
    // "Conectează acum" deschide un panou inline (setShowWaPanel), nu mai navighează la /connect
    await page.getByRole('button', { name: /Conectează acum/i }).first().click()
    await expect(page.getByText(/Conectare WhatsApp/i)).toBeVisible()
  })

  test('navigarea funcționează prin meniul hamburger: Conversații → Setări → Dashboard', async ({ page }) => {
    await createUser({ email: 'nav@example.com', withSubscription: true })
    await loginAs(page, 'nav@example.com')

    // Nav-ul e într-un drawer deschis prin butonul „Deschide meniul". Se închide la navigare.
    const openMenu = () => page.getByRole('button', { name: /Deschide meniul/i }).click()

    await openMenu()
    await page.getByRole('link', { name: /Conversații/i }).click()
    await expect(page).toHaveURL(/\/conversations/)

    await openMenu()
    await page.getByRole('link', { name: /Setări/i }).click()
    await expect(page).toHaveURL(/\/settings/)

    await openMenu()
    await page.getByRole('link', { name: /Dashboard/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('fără subscripție → redirect la /subscribe', async ({ page }) => {
    await createUser({ email: 'nosub@example.com', withSubscription: false })
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('nosub@example.com')
    await page.getByLabel(/parolă/i).fill(DEFAULT_PASSWORD)
    await page.getByRole('button', { name: /autentifică|intră|login/i }).click()
    await expect(page).toHaveURL(/\/subscribe/)
  })
})
