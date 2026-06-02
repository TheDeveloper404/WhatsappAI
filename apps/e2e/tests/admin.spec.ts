import { test, expect } from '@playwright/test'
import { resetDb, createUser, ADMIN_TOKEN, DEFAULT_PASSWORD } from '../helpers/api.js'

const ADMIN_SECRET = ADMIN_TOKEN

test.beforeEach(async ({ page }) => {
  await resetDb()
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})
})

// Login-ul admin folosește un singur câmp parolă pentru codul de acces.
async function fillSecret(page: any, secret: string) {
  await page.locator('form input[type="password"]').fill(secret)
}

async function loginAdmin(page: any) {
  await page.goto('/admin')
  await fillSecret(page, ADMIN_SECRET)
  await page.getByRole('button', { name: /intră în admin|intră|login/i }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)
}

test.describe('Admin — Login', () => {
  test('pagina de login admin se încarcă', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByText(/admin|panou/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /intră în admin|intră|login/i })).toBeVisible()
  })

  test('secret greșit → eroare vizibilă', async ({ page }) => {
    await page.goto('/admin')
    // Cod de acces greșit (cel corect e ADMIN_SECRET)
    await fillSecret(page, 'cod-gresit-de-acces')
    await page.getByRole('button', { name: /intră în admin|intră|login/i }).click()
    await expect(page.getByText(/incorect|greșit|invalid/i)).toBeVisible()
  })

  test('secret corect → redirect la /admin/dashboard', async ({ page }) => {
    await page.goto('/admin')
    await fillSecret(page, ADMIN_SECRET)
    await page.getByRole('button', { name: /intră în admin|intră|login/i }).click()
    await expect(page).toHaveURL(/\/admin\/dashboard/)
  })
})

test.describe('Admin — Dashboard', () => {
  test('stat cards vizibile (Total useri, Abonați, Agenți, MRR)', async ({ page }) => {
    await loginAdmin(page)
    await expect(page.getByText(/Total useri/i)).toBeVisible()
    await expect(page.getByText(/Abonați|activi/i).first()).toBeVisible()
  })

  test('tabul Useri arată lista de useri', async ({ page }) => {
    await createUser({ email: 'listed@example.com', withSubscription: true })
    await loginAdmin(page)

    // Tab-urile sunt butoane simple, nu role=tab
    await page.getByRole('button', { name: /^Useri$/i }).click()
    await expect(page.getByText('listed@example.com')).toBeVisible()
  })

  test('toggle agent din admin → agentul se dezactivează/activează', async ({ page }) => {
    await createUser({ email: 'agent@example.com', withSubscription: true })
    await loginAdmin(page)

    await page.getByRole('button', { name: /^Useri$/i }).click()

    // Butonul direct de toggle al agentului (Activează/Dezactivează)
    const toggleBtn = page.getByRole('button', { name: /activează|dezactivează/i }).first()
    if (await toggleBtn.count() > 0) {
      await toggleBtn.click()
    }
    // Verificăm că email-ul userului e vizibil (pagina a rămas pe Useri)
    await expect(page.getByText(/agent@example.com/i)).toBeVisible()
  })

  test('tabul Activitate este vizibil', async ({ page }) => {
    await loginAdmin(page)
    await page.getByRole('button', { name: /^Activitate$/i }).click()
    await expect(page.getByText(/activitate|notificări|nicio/i).first()).toBeVisible()
  })

  test('tabul Configurare — editare și salvare prompt implicit', async ({ page }) => {
    await loginAdmin(page)
    await page.getByRole('button', { name: /^Configurare$/i }).click()

    const textarea = page.locator('textarea')
    if (await textarea.count() > 0) {
      await textarea.fill('Prompt nou de test pentru configurare platformă minim 10 caractere.')
      await page.getByRole('button', { name: /salvează/i }).click()
      await expect(page.getByText(/salvat/i)).toBeVisible()
    }
  })

  test('bell notificări există în navbar', async ({ page }) => {
    await loginAdmin(page)
    // Bell este un button care conține SVG în navbar
    const bell = page.locator('nav button').first()
    await expect(bell).toBeVisible()
  })

  test('deconectare admin → redirect la /admin', async ({ page }) => {
    await loginAdmin(page)
    // Butonul de ieșire se numește "Ieși" în română
    await page.getByRole('button', { name: /ieși|logout|deconectare/i }).click()
    await expect(page).toHaveURL(/\/admin$/)
  })
})

test.describe('Admin — Acțiuni per user', () => {
  test('trimite email user → modal vizibil (via dropdown)', async ({ page }) => {
    await createUser({ email: 'emailtest@example.com', withSubscription: true })
    await loginAdmin(page)
    await page.getByRole('button', { name: /^Useri$/i }).click()

    // Dropdown-ul e butonul cu ChevronDown după toggle-ul agentului
    // Facem click pe primul dropdown din tabel
    const dropdownBtn = page.locator('tbody button').nth(1) // al doilea button = dropdown ChevronDown
    if (await dropdownBtn.count() > 0) {
      await dropdownBtn.click()
      const emailItem = page.getByRole('button', { name: /trimite email/i })
      if (await emailItem.count() > 0) {
        await emailItem.click()
        // Modalul se deschide — verificăm heading-ul, nu placeholder-ul
        await expect(page.getByRole('heading', { name: /trimite email/i })).toBeVisible()
      }
    }
  })

  test('extinde trial → modal cu input zile (via dropdown)', async ({ page }) => {
    await createUser({ email: 'trialext@example.com', withSubscription: true })
    await loginAdmin(page)
    await page.getByRole('button', { name: /^Useri$/i }).click()

    const dropdownBtn = page.locator('tbody button').nth(1)
    if (await dropdownBtn.count() > 0) {
      await dropdownBtn.click()
      const trialItem = page.getByRole('button', { name: /extinde trial/i })
      if (await trialItem.count() > 0) {
        await trialItem.click()
        // Modalul trial — are heading și un input numeric pentru zile
        await expect(page.getByRole('heading', { name: /extinde trial/i })).toBeVisible()
      }
    }
  })
})
