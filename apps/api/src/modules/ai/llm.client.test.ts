import { describe, it, expect, vi, afterEach } from 'vitest'
import { transcribeAudio, isTranscriptionEnabled } from './llm.client.js'

function okResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
}

describe('transcribeAudio (OpenRouter input_audio)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('e activă când LLM_AUDIO_MODEL e setat', () => {
    expect(isTranscriptionEnabled).toBe(true)
  })

  it('trimite audio-ul ca input_audio base64 la LLM_AUDIO_MODEL, cu format ogg din mimetype-ul WhatsApp', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('  Salut, ce faci?  '))
    vi.stubGlobal('fetch', fetchMock)
    const audio = Buffer.from('fake-opus-bytes')

    const text = await transcribeAudio(audio, 'audio/ogg; codecs=opus')

    expect(text).toBe('Salut, ce faci?')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.model).toBe('test/audio-model')
    expect(body.temperature).toBe(0)
    const parts = body.messages[0].content
    expect(parts).toContainEqual({
      type: 'input_audio',
      input_audio: { data: audio.toString('base64'), format: 'ogg' },
    })
  })

  it('HTTP non-ok → aruncă eroare doar cu status și model (fără corpul răspunsului)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('echo: conținut sensibil', { status: 400 })))

    await expect(transcribeAudio(Buffer.from('x'), 'audio/ogg')).rejects.toThrow('OpenRouter HTTP 400 (test/audio-model)')
  })
})
