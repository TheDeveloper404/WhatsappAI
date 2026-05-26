// Helper pentru apeluri directe la API în setup-ul testelor

const API = 'http://localhost:3001'
const ADMIN_SECRET = process.env.E2E_ADMIN_SECRET ?? 'test_admin_secret_minimum_32_chars_here'

export async function resetDb() {
  await fetch(`${API}/api/v1/test/reset`, { method: 'POST' })
}

export async function createUser(opts: {
  email: string
  name?: string
  password?: string
  withSubscription?: boolean
}): Promise<{ userId: string; email: string; accessToken: string }> {
  const res = await fetch(`${API}/api/v1/test/create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API}/api/v1/test/email-token?email=${encodeURIComponent(email)}`)
  const { token } = await res.json()
  return token
}

export async function getResetToken(email: string): Promise<string | null> {
  const res = await fetch(`${API}/api/v1/test/create-reset-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const { token } = await res.json()
  return token
}

export async function activateAgent(userId: string) {
  await fetch(`${API}/api/v1/test/activate-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
}

export const ADMIN_TOKEN = ADMIN_SECRET
export const DEFAULT_PASSWORD = 'Password123!'
