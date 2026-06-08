import { describe, it, expect } from 'vitest'
import { parseBookingIntent } from './groq.client.js'

// Testează DOAR validarea output-ului LLM pentru fluxul de programări (partea critică).
// Fără rețea. La fel ca la comenzi: LLM-ul propune, codul dispune — serviciul invalid se aruncă,
// „ready" fără serviciu/interval se retrogradează. B10: serviceIds[] (una sau mai multe servicii).
const VALID = new Set(['s1', 's2'])

describe('parseBookingIntent', () => {
  it('parsează o programare „ready" validă (un serviciu)', () => {
    const r = parseBookingIntent(
      '{"phase":"ready","serviceIds":["s1"],"requestedSlot":"vineri pe la 15","details":"","missingInfo":[],"customerNote":"Andrei"}',
      VALID,
    )
    expect(r.phase).toBe('ready')
    expect(r.serviceIds).toEqual(['s1'])
    expect(r.requestedSlot).toBe('vineri pe la 15')
    expect(r.customerNote).toBe('Andrei')
  })

  it('parsează mai multe servicii (B10) + deduplică', () => {
    const r = parseBookingIntent(
      '{"phase":"ready","serviceIds":["s1","s2","s1"],"requestedSlot":"luni la 16","missingInfo":[]}',
      VALID,
    )
    expect(r.phase).toBe('ready')
    expect(r.serviceIds).toEqual(['s1', 's2'])
  })

  it('compat: acceptă „serviceId" string vechi → serviceIds', () => {
    const r = parseBookingIntent(
      '{"phase":"ready","serviceId":"s2","requestedSlot":"mâine","missingInfo":[]}',
      VALID,
    )
    expect(r.serviceIds).toEqual(['s2'])
  })

  it('extrage JSON împachetat în ```json``` / text', () => {
    const r = parseBookingIntent('```json\n{"phase":"collecting","serviceIds":[],"missingInfo":["ziua și ora"]}\n```', VALID)
    expect(r.phase).toBe('collecting')
    expect(r.missingInfo).toEqual(['ziua și ora'])
  })

  it('id-uri în afara catalogului → eliminate; ready fără serviciu valid → collecting', () => {
    const r = parseBookingIntent('{"phase":"ready","serviceIds":["FAKE"],"requestedSlot":"mâine","missingInfo":[]}', VALID)
    expect(r.serviceIds).toEqual([])
    expect(r.phase).toBe('collecting')
  })

  it('„ready" fără interval → retrogradat la „collecting"', () => {
    const r = parseBookingIntent('{"phase":"ready","serviceIds":["s1"],"requestedSlot":"","missingInfo":["ora"]}', VALID)
    expect(r.phase).toBe('collecting')
  })

  it('non-none complet gol → none (nu e programare)', () => {
    const r = parseBookingIntent('{"phase":"collecting","serviceIds":[],"requestedSlot":"","missingInfo":[],"details":""}', VALID)
    expect(r.phase).toBe('none')
  })

  it('limitează requestedSlot la 200 și missingInfo la 8 intrări', () => {
    const many = Array.from({ length: 20 }, (_, i) => `"item ${i}"`).join(',')
    const r = parseBookingIntent(
      `{"phase":"collecting","serviceIds":["s2"],"requestedSlot":"${'x'.repeat(400)}","missingInfo":[${many}]}`,
      VALID,
    )
    expect(r.requestedSlot.length).toBe(200)
    expect(r.missingInfo.length).toBe(8)
  })

  it('phase invalid → none', () => {
    expect(parseBookingIntent('{"phase":"executing","serviceIds":["s1"],"requestedSlot":"azi"}', VALID).phase).toBe('none')
  })

  it('fallback gol când nu există JSON', () => {
    expect(parseBookingIntent('nu am putut analiza', VALID)).toEqual({
      phase: 'none', serviceIds: [], requestedSlot: '', details: '', missingInfo: [], customerNote: '',
    })
  })

  it('fallback gol la JSON invalid', () => {
    expect(parseBookingIntent('{phase: ready, serviceId: }', VALID).phase).toBe('none')
  })
})
