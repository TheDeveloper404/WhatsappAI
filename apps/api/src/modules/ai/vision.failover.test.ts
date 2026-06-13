import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Test FOCUSAT pe failover-ul vision Gemini→Groq din extractFromImage. Stub pe global fetch +
// env mockuit (controlăm prezența cheilor). Fără rețea reală.
vi.mock('../../config/env.js', () => ({
  env: { GEMINI_API_KEY: 'gem-key', GROQ_API_KEY: 'groq-key', LLM_PROVIDER: 'gemini' },
}))

import { extractFromImage } from './groq.client.js'
import { env } from '../../config/env.js'

const BUF = Buffer.from('fake-image-bytes')
const e = env as { GEMINI_API_KEY?: string; GROQ_API_KEY?: string }

// Răspunsuri minimale în forma fiecărui furnizor.
const geminiOk = (text: string) => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
})
const groqOk = (content: string) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
})
const httpErr = (status: number) => ({ ok: false, status, text: async () => 'boom' })

beforeEach(() => {
  e.GEMINI_API_KEY = 'gem-key'
  e.GROQ_API_KEY = 'groq-key'
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('vision failover — extractFromImage', () => {
  it('Gemini primar OK → folosește Gemini, NU mai cheamă Groq', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiOk('SPH: -1.5'))
    vi.stubGlobal('fetch', fetchMock)

    expect(await extractFromImage(BUF, 'image/jpeg', '')).toBe('SPH: -1.5')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('generativelanguage.googleapis.com')
  })

  it('Gemini pică → failover automat pe Groq', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(httpErr(503)) // Gemini jos
      .mockResolvedValueOnce(groqOk('GROQ: extras'))
    vi.stubGlobal('fetch', fetchMock)

    expect(await extractFromImage(BUF, 'image/jpeg', '')).toBe('GROQ: extras')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('api.groq.com')
  })

  it('fără GEMINI_API_KEY → Groq devine primar direct (un singur apel, la Groq)', async () => {
    e.GEMINI_API_KEY = undefined
    const fetchMock = vi.fn().mockResolvedValue(groqOk('GROQ direct'))
    vi.stubGlobal('fetch', fetchMock)

    expect(await extractFromImage(BUF, 'image/jpeg', '')).toBe('GROQ direct')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.groq.com')
  })

  it('ambii furnizori pică → aruncă (apelantul face fail-open)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(httpErr(500))
    vi.stubGlobal('fetch', fetchMock)

    await expect(extractFromImage(BUF, 'image/jpeg', '')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(2) // Gemini + Groq, ambii eșuați
  })
})
