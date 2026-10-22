import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./ai.repository.js', async importOriginal => {
  const actual = await importOriginal<typeof import('./ai.repository.js')>()
  return {
    ...actual,
    aiRepository: {
      markMessageProcessed: vi.fn().mockResolvedValue(true),
      saveMessage: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn().mockResolvedValue({
        isActive: true, pauseUntil: null, timerMinutes: 1, notifyOnAiTakeover: false,
        systemPrompt: '', writingStyle: '', knowledgeBase: '',
      }),
      isBlacklisted: vi.fn().mockResolvedValue(false),
      getUnresolvedBlacklist: vi.fn().mockResolvedValue([]),
      getContext: vi.fn().mockResolvedValue([]),
      getContactMemory: vi.fn().mockResolvedValue(null),
      upsertContactMemory: vi.fn().mockResolvedValue(undefined),
    },
  }
})

vi.mock('./llm.client.js', async importOriginal => {
  const actual = await importOriginal<typeof import('./llm.client.js')>()
  return {
    ...actual,
    chat: vi.fn().mockResolvedValue('Bună seara!'),
    extractContactMemory: vi.fn().mockResolvedValue(''),
  }
})

import { handleMessages } from './message.handler.js'
import { chat } from './llm.client.js'

const CONTACT_JID = '40711111111@s.whatsapp.net'
let seq = 0
function msg(fromMe: boolean, text: string, remoteJid = CONTACT_JID) {
  return { key: { remoteJid, fromMe, id: `m${++seq}` }, message: { conversation: text } }
}

describe('handleMessages — timer de inactivitate', () => {
  const sock = { user: { id: '40700000000:1@s.whatsapp.net' }, sendMessage: vi.fn().mockResolvedValue({}) } as any

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T19:45:00Z'))
  })
  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync() // nu lăsăm timere de la un test la altul
    vi.useRealTimers()
    vi.mocked(chat).mockClear()
  })

  // Caz real (2026-10-21): mesaj programat cât owner-ul era activ + al doilea mesaj după ce timer-ul de
  // inactivitate a expirat → plecau două răspunsuri AI.
  it('mesajul venit după expirarea timer-ului înlocuiește răspunsul programat (fără răspuns dublu)', async () => {
    await handleMessages('owner', sock, [msg(true, 'Revin imediat')])

    await vi.advanceTimersByTimeAsync(30_000)
    await handleMessages('owner', sock, [msg(false, 'Bună seara, vreau o ofertă pentru un site')])

    await vi.advanceTimersByTimeAsync(40_000) // owner-ul nu mai e activ (timer 1 min)
    await handleMessages('owner', sock, [msg(false, 'Am văzut site-ul dvs')])

    await vi.advanceTimersByTimeAsync(120_000) // răspunsul programat inițial ar fi plecat aici
    expect(chat).toHaveBeenCalledTimes(1)
  })

  it('owner inactiv: mai multe mesaje la rând → un singur răspuns, la 10s după ultimul', async () => {
    // Alt contact: tracker-ul de activitate e în RAM și ar păstra răspunsul owner-ului din testul anterior.
    const jid = '40722222222@s.whatsapp.net'
    await handleMessages('owner', sock, [msg(false, 'Bună', jid)])
    await vi.advanceTimersByTimeAsync(3_000)
    await handleMessages('owner', sock, [msg(false, 'Aș vrea o ofertă pentru un site', jid)])

    await vi.advanceTimersByTimeAsync(9_000) // 12s după primul, 9s după ultimul
    expect(chat).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_000)
    expect(chat).toHaveBeenCalledTimes(1)
  })
})
