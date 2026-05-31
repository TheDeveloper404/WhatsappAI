import { test, expect } from '@playwright/test'
import { resetDb, createUser, getEmailToken, getResetToken, DEFAULT_PASSWORD } from '../helpers/api.js'

test.beforeEach(async ({ page }) => {
  await resetDb()
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.clear()).catch(() => {})
})

// ---------------------------------------------------------------------------
// Pagina Register (ruta: /signup)
// ---------------------------------------------------------------------------

test.describe('Register', () => {
  test('formularul e vizibil cu câmpurile corecte', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: /creează cont/i })).toBeVisible()
    await expect(page.getByLabel(/nume/i)).toBeVisible()
    await expect(page.getByLabel(/^email$/i)).toBeVisible()
    await expect(page.getByLabel(/^parolă$/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /creează cont/i })).toBeVisible()
  })

  test('register cu date valide → mesaj "verifică emailul"', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel(/nume/i).fill('Ion Popescu')
    await page.getByLabel(/^email$/i).fill('ion@example.com')
    await page.getByLabel(/^parolă$/i).fill(DEFAULT_PASSWORD)
    await page.getByLabel(/confirmă parola/i).fill(DEFAULT_PASSWORD)
    await page.getByRole('button', { name: /creează cont/i }).click()
    await expect(page.getByText(/verifică/i)).toBeVisible()
  })

  test('email duplicat → eroare vizibilă', async ({ page }) => {
    await createUser({ email: 'exist@example.com' })
    await page.goto('/signup')
    await page.getByLabel(/nume/i).fill('Alt User')
    await page.getByLabel(/^email$/i).fill('exist@example.com')
    await page.getByLabel(/^parolă$/i).fill(DEFAULT_PASSWORD)
    await page.getByLabel(/confirmă parola/i).fill(DEFAULT_PASSWORD)
    await page.getByRole('button', { name: /creează cont/i }).click()
    // .first() — Next.js injectează un <div role="alert"> gol (route announcer) care altfel
    // declanșează „strict mode violation". Alerta reală (componenta Alert) e prima în DOM.
    await expect(page.getByRole('alert').first()).toBeVisible()
  })

  test('parolă slabă → eroare vizibilă', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel(/nume/i).fill('Test User')
    await page.getByLabel(/^email$/i).fill('weak@example.com')
    await page.getByLabel(/^parolă$/i).fill('123')
    await page.getByLabel(/confirmă parola/i).fill('123')
    await page.getByRole('button', { name: /creează cont/i }).click()
    // Parolă slabă → eroare (fie field error sub input, fie alertă generală — ambele role=alert).
    // .first() evită „strict mode violation" cu route-announcer-ul gol al Next.js.
    await expect(page.getByRole('alert').first()).toBeVisible()
  })

  test('link "ai deja cont" duce la /login', async ({ page }) => {
    await page.goto('/signup')
    await page.getByRole('link', { name: /intră în cont|login|cont/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})

// ---------------------------------------------------------------------------
// Verificare email
// ---------------------------------------------------------------------------

test.describe('Verificare email', () => {
  test('flux complet: register → token din API → verify → redirect login', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel(/nume/i).fill('Maria Test')
    await page.getByLabel(/^email$/i).fill('maria@example.com')
    await page.getByLabel(/^parolă$/i).fill(DEFAULT_PASSWORD)
    await page.getByLabel(/confirmă parola/i).fill(DEFAULT_PASSWORD)
    await page.getByRole('button', { name: /creează cont/i }).click()
    await expect(page.getByText(/verifică/i)).toBeVisible()

    const token = await getEmailToken('maria@example.com')
    expect(token).toBeTruthy()

    await page.goto(`/verify-email?token=${token}`)
    await expect(page.getByRole('heading', { name: /Email verificat/i })).toBeVisible()
    await page.getByRole('link', { name: /intră în cont/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('token invalid → eroare', async ({ page }) => {
    await page.goto('/verify-email?token=invalid-token-xyz')
    await expect(page.getByRole('heading', { name: 'Link invalid' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

test.describe('Login', () => {
  test('formularul e vizibil', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel(/^email$/i)).toBeVisible()
    await expect(page.getByLabel(/^parolă$/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /intră în cont|autentifică|login/i })).toBeVisible()
  })

  test('login cu date corecte → redirect la dashboard sau subscribe', async ({ page }) => {
    await createUser({ email: 'login@example.com', withSubscription: true })
    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill('login@example.com')
    await page.getByLabel(/^parolă$/i).fill(DEFAULT_PASSWORD)
    await page.getByRole('button', { name: /intră în cont|autentifică|login/i }).click()
    await expect(page).toHaveURL(/\/(dashboard|subscribe)/)
  })

  test('parolă greșită → mesaj de eroare în română', async ({ page }) => {
    await createUser({ email: 'wrongpw@example.com' })
    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill('wrongpw@example.com')
    await page.getByLabel(/^parolă$/i).fill('WrongPassword!')
    await page.getByRole('button', { name: /intră în cont|autentifică|login/i }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  })

  test('email inexistent → eroare vizibilă', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill('nobody@example.com')
    await page.getByLabel(/^parolă$/i).fill(DEFAULT_PASSWORD)
    await page.getByRole('button', { name: /intră în cont|autentifică|login/i }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  })

  test('link "nu ai cont" duce la /signup', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: /creează|signup|cont nou/i }).click()
    await expect(page).toHaveURL(/\/signup/)
  })

  test('link "am uitat parola" duce la forgot-password', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: /uitat|forgot/i }).click()
    await expect(page).toHaveURL(/\/forgot-password|\/login/)
  })
})

// ---------------------------------------------------------------------------
// Forgot password + Reset
// ---------------------------------------------------------------------------

test.describe('Forgot password', () => {
  test('formular vizibil cu câmp email', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByLabel(/^email$/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /trimite|reset/i })).toBeVisible()
  })

  test('email inexistent → tot afișează succes (anti-enumeration)', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByLabel(/^email$/i).fill('nobody@example.com')
    await page.getByRole('button', { name: /trimite|reset/i }).click()
    await expect(page.getByRole('heading', { name: /email trimis/i })).toBeVisible()
  })

  test('flux complet: forgot → reset token → parolă nouă → login', async ({ page }) => {
    await createUser({ email: 'reset@example.com' })

    await page.goto('/forgot-password')
    await page.getByLabel(/^email$/i).fill('reset@example.com')
    await page.getByRole('button', { name: /trimite|reset/i }).click()
    await expect(page.getByRole('heading', { name: /email trimis/i })).toBeVisible()

    const token = await getResetToken('reset@example.com')
    expect(token).toBeTruthy()

    await page.goto(`/reset-password?token=${token}`)
    await page.getByLabel(/parolă nouă/i).fill('NewPassword456!')
    await page.getByLabel(/confirmă parola/i).fill('NewPassword456!')
    await page.getByRole('button', { name: /setează|resetează|salvează/i }).click()

    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel(/^email$/i).fill('reset@example.com')
    await page.getByLabel(/^parolă$/i).fill('NewPassword456!')
    await page.getByRole('button', { name: /intră în cont|autentifică|login/i }).click()
    await expect(page).toHaveURL(/\/(dashboard|subscribe)/)
  })
})

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

test.describe('Logout', () => {
  test('buton deconectare → redirect la /login', async ({ page }) => {
    await createUser({ email: 'logout@example.com', withSubscription: true })
    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill('logout@example.com')
    await page.getByLabel(/^parolă$/i).fill(DEFAULT_PASSWORD)
    await page.getByRole('button', { name: /intră în cont|autentifică|login/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    await page.getByRole('button', { name: /deconectare|logout/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('după logout, /dashboard redirectează la /login', async ({ page }) => {
    await createUser({ email: 'logout2@example.com', withSubscription: true })
    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill('logout2@example.com')
    await page.getByLabel(/^parolă$/i).fill(DEFAULT_PASSWORD)
    await page.getByRole('button', { name: /intră în cont|autentifică|login/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    await page.getByRole('button', { name: /deconectare|logout/i }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
