// Helper pentru apeluri directe la API în setup-ul testelor

// 127.0.0.1 explicit (nu `localhost`): pe Windows `localhost` rezolvă întâi la IPv6 ::1, iar
// fetch-ul din Node poate da ECONNREFUSED/timeout dacă API-ul ascultă pe IPv4.
const API = 'http://127.0.0.1:3001'
const ADMIN_SECRET = process.env.E2E_ADMIN_SECRET ?? 'test_admin_secret_minimum_32_chars_here'
const E2E_SECRET = process.env.E2E_SECRET ?? ''

const e2eHeaders = { 'x-e2e-secret': E2E_SECRET }

export async function resetDb() {
  await fetch(`${API}/api/v1/test/reset`, { method: 'POST', headers: e2eHeaders })
}

export async function createUser(opts: {
  email: string
  name?: string
  password?: string
  withSubscription?: boolean
}): Promise<{ userId: string; email: string; accessToken: string }> {
  const res = await fetch(`${API}/api/v1/test/create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...e2eHeaders },
    body: JSON.stringify({
      name: opts.name ?? 'Test User',
      email: opts.email,
      password: opts.password ?? 'Password123!',
      withSubscription: opts.withSubscription ?? true,
    }),
  })
  return res.json()
}

export async function getEmailToken(email: string): Promise<string | null> {
  const res = await fetch(`${API}/api/v1/test/email-token?email=${encodeURIComponent(email)}`, { headers: e2eHeaders })
  const { token } = await res.json()
  return token
}

export async function getResetToken(email: string): Promise<string | null> {
  const res = await fetch(`${API}/api/v1/test/create-reset-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...e2eHeaders },
    body: JSON.stringify({ email }),
  })
  const { token } = await res.json()
  return token
}

export async function activateAgent(userId: string) {
  await fetch(`${API}/api/v1/test/activate-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...e2eHeaders },
    body: JSON.stringify({ userId }),
  })
}

export const ADMIN_TOKEN = ADMIN_SECRET
export const DEFAULT_PASSWORD = 'Password123!'
