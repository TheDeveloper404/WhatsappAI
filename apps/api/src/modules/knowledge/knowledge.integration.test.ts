import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import FormData from 'form-data'
import { buildApp } from '../../app.js'
import { pool } from '../../config/database.js'

vi.mock('../../utils/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendAdminNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCustomEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../config/stripe.js', () => ({
  stripe: {
    customers: { create: vi.fn().mockResolvedValue({ id: 'cus_test' }) },
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }) } },
    billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }) } },
  },
}))

// Embeddings fără rețea: vector constant pentru orice text => cosine(doc, query) = 1 (trece pragul).
vi.mock('../ai/groq.client.js', async (importActual) => ({
  ...(await importActual<typeof import('../ai/groq.client.js')>()),
  embedTexts: vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0])),
}))

import { sendVerificationEmail } from '../../utils/email.js'
import { knowledgeService } from './knowledge.service.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

async function registerAndLogin(email: string) {
  vi.mocked(sendVerificationEmail).mockClear()
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'KB User', email, password: 'Password123!' },
  })
  const [, , token] = vi.mocked(sendVerificationEmail).mock.calls[0] as [string, string, string]
  await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token } })
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'Password123!' },
  })
  return res.json().accessToken as string
}

function uploadFile(token: string, content: string, filename: string, contentType: string) {
  const form = new FormData()
  form.append('file', Buffer.from(content), { filename, contentType })
  return app.inject({
    method: 'POST',
    url: '/api/v1/knowledge/documents',
    headers: { ...form.getHeaders(), authorization: `Bearer ${token}` },
    payload: form,
  })
}

async function userIdFor(email: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
  return rows[0].id
}

describe('Knowledge / RAG', () => {
  it('401 — listă fără token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/knowledge/documents' })
    expect(res.statusCode).toBe(401)
  })

  it('upload TXT → 201, document indexat cu char_count', async () => {
    const token = await registerAndLogin('kb-upload@test.com')
    const res = await uploadFile(token, 'Programul nostru este Luni-Vineri 09:00-17:00.', 'orar.txt', 'text/plain')
    expect(res.statusCode).toBe(201)
    const { document } = res.json()
    expect(document.filename).toBe('orar.txt')
    expect(document.status).toBe('ready')
    expect(document.charCount).toBeGreaterThan(0)
  })

  it('listă → conține documentul încărcat', async () => {
    const token = await registerAndLogin('kb-list@test.com')
    await uploadFile(token, 'Livrăm în toată țara în 2-3 zile.', 'livrare.txt', 'text/plain')
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/knowledge/documents',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const { documents } = res.json()
    expect(documents.some((d: { filename: string }) => d.filename === 'livrare.txt')).toBe(true)
  })

  it('tip nesuportat → 422', async () => {
    const token = await registerAndLogin('kb-badtype@test.com')
    const res = await uploadFile(token, 'binar', 'imagine.png', 'image/png')
    expect(res.statusCode).toBe(422)
  })

  it('retrieve → întoarce conținutul relevant', async () => {
    const email = 'kb-retrieve@test.com'
    const token = await registerAndLogin(email)
    await uploadFile(token, 'Acceptăm plata cu cardul și ramburs la livrare.', 'plata.txt', 'text/plain')
    const userId = await userIdFor(email)
    const chunks = await knowledgeService.retrieve(userId, 'cum pot plăti?')
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]).toContain('ramburs')
  })

  it('ștergere document propriu → 204, apoi nu mai e în listă', async () => {
    const token = await registerAndLogin('kb-delete@test.com')
    const up = await uploadFile(token, 'Acest document urmează să fie șters în cadrul testului.', 'temp.txt', 'text/plain')
    const { document } = up.json()
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/knowledge/documents/${document.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(del.statusCode).toBe(204)
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/knowledge/documents',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(list.json().documents.some((d: { id: string }) => d.id === document.id)).toBe(false)
  })

  it('IDOR — userul B nu poate șterge documentul lui A (404)', async () => {
    const tokenA = await registerAndLogin('kb-owner-a@test.com')
    const tokenB = await registerAndLogin('kb-attacker-b@test.com')
    const up = await uploadFile(tokenA, 'Acesta este documentul secret al utilizatorului A.', 'a.txt', 'text/plain')
    const { document } = up.json()
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/knowledge/documents/${document.id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    })
    expect(del.statusCode).toBe(404)
    // Documentul lui A e intact.
    const listA = await app.inject({
      method: 'GET',
      url: '/api/v1/knowledge/documents',
      headers: { authorization: `Bearer ${tokenA}` },
    })
    expect(listA.json().documents.some((d: { id: string }) => d.id === document.id)).toBe(true)
  })
})
