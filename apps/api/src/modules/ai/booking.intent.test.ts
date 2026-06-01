import { describe, it, expect } from 'vitest'
import { parseBookingIntent } from './groq.client.js'

// Testează DOAR validarea output-ului LLM pentru fluxul de programări (partea critică).
// Fără rețea. La fel ca la comenzi: LLM-ul propune, codul dispune — serviciul invalid se aruncă,
// „ready" fără serviciu/interval se retrogradează.
const VALID = new Set(['s1', 's2'])

describe('parseBookingIntent', () => {
  it('parsează o programare „ready" validă', () => {
    const r = parseBookingIntent(
      '{"phase":"ready","serviceId":"s1","requestedSlot":"vineri pe la 15","details":"","missingInfo":[],"customerNote":"Andrei"}',
      VALID,
    )
    expect(r.phase).toBe('ready')
    expect(r.serviceId).toBe('s1')
    expect(r.requestedSlot).toBe('vineri pe la 15')
    expect(r.customerNote).toBe('Andrei')
  })

  it('extrage JSON împachetat în ```json``` / text', () => {
    const r = parseBookingIntent('```json\n{"phase":"collecting","serviceId":null,"missingInfo":["ziua și ora"]}\n```', VALID)
    expect(r.phase).toBe('collecting')
    expect(r.missingInfo).toEqual(['ziua și ora'])
  })

  it('serviceId în afara catalogului → null', () => {
    const r = parseBookingIntent('{"phase":"ready","serviceId":"FAKE","requestedSlot":"mâine","missingInfo":[]}', VALID)
    expect(r.serviceId).toBeNull()
    // ready fără serviciu valid → retrogradat collecting
    expect(r.phase).toBe('collecting')
  })

  it('„ready" fără interval → retrogradat la „collecting"', () => {
    const r = parseBookingIntent('{"phase":"ready","serviceId":"s1","requestedSlot":"","missingInfo":["ora"]}', VALID)
    expect(r.phase).toBe('collecting')
  })

  it('non-none complet gol → none (nu e programare)', () => {
    const r = parseBookingIntent('{"phase":"collecting","serviceId":null,"requestedSlot":"","missingInfo":[],"details":""}', VALID)
    expect(r.phase).toBe('none')
  })

  it('limitează requestedSlot la 200 și missingInfo la 8 intrări', () => {
    const many = Array.from({ length: 20 }, (_, i) => `"item ${i}"`).join(',')
    const r = parseBookingIntent(
      `{"phase":"collecting","serviceId":"s2","requestedSlot":"${'x'.repeat(400)}","missingInfo":[${many}]}`,
      VALID,
    )
    expect(r.requestedSlot.length).toBe(200)
    expect(r.missingInfo.length).toBe(8)
  })

  it('phase invalid → none', () => {
    expect(parseBookingIntent('{"phase":"executing","serviceId":"s1","requestedSlot":"azi"}', VALID).phase).toBe('none')
  })

  it('fallback gol când nu există JSON', () => {
    expect(parseBookingIntent('nu am putut analiza', VALID)).toEqual({
      phase: 'none', serviceId: null, requestedSlot: '', details: '', missingInfo: [], customerNote: '',
    })
  })

  it('fallback gol la JSON invalid', () => {
    expect(parseBookingIntent('{phase: ready, serviceId: }', VALID).phase).toBe('none')
  })
})
