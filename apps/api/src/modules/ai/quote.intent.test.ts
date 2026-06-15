import { describe, it, expect } from 'vitest'
import { parseQuoteIntent } from './groq.client.js'

// Testează DOAR validarea output-ului LLM pentru fluxul de deviz (0.5.1). Fără rețea.
// La fel ca la comenzi/programări: LLM-ul propune, codul dispune — serviciul invalid se aruncă,
// „ready" fără serviciu se retrogradează. Devizul NU are preț și NU are oră (handoff la owner).
const VALID = new Set(['q1', 'q2'])

describe('parseQuoteIntent', () => {
  it('parsează o cerere de deviz „ready" validă', () => {
    const r = parseQuoteIntent(
      '{"phase":"ready","serviceIds":["q1"],"details":"talon seria AB, zgomot la frânare","missingInfo":[],"customerNote":"Andrei"}',
      VALID,
    )
    expect(r.phase).toBe('ready')
    expect(r.serviceIds).toEqual(['q1'])
    expect(r.details).toContain('talon')
    expect(r.customerNote).toBe('Andrei')
  })

  it('mai multe servicii-deviz + deduplică', () => {
    const r = parseQuoteIntent('{"phase":"ready","serviceIds":["q1","q2","q1"],"details":"VIN WVW..."}', VALID)
    expect(r.serviceIds).toEqual(['q1', 'q2'])
  })

  it('compat: acceptă „serviceId" string vechi', () => {
    const r = parseQuoteIntent('{"phase":"ready","serviceId":"q2","details":"martor motor aprins"}', VALID)
    expect(r.serviceIds).toEqual(['q2'])
  })

  it('extrage JSON împachetat în ```json``` / text', () => {
    const r = parseQuoteIntent('```json\n{"phase":"collecting","serviceIds":[],"missingInfo":["talonul sau VIN-ul"]}\n```', VALID)
    expect(r.phase).toBe('collecting')
    expect(r.missingInfo).toEqual(['talonul sau VIN-ul'])
  })

  it('id-uri în afara catalogului → eliminate; ready fără serviciu valid → collecting', () => {
    const r = parseQuoteIntent('{"phase":"ready","serviceIds":["FAKE"],"details":"ceva"}', VALID)
    expect(r.serviceIds).toEqual([])
    expect(r.phase).toBe('collecting')
  })

  it('non-none complet gol → none (nu e cerere de deviz)', () => {
    const r = parseQuoteIntent('{"phase":"collecting","serviceIds":[],"details":"","missingInfo":[]}', VALID)
    expect(r.phase).toBe('none')
  })

  it('limitează details la 1000 și missingInfo la 8 intrări', () => {
    const many = Array.from({ length: 20 }, (_, i) => `"item ${i}"`).join(',')
    const r = parseQuoteIntent(
      `{"phase":"collecting","serviceIds":["q1"],"details":"${'x'.repeat(1500)}","missingInfo":[${many}]}`,
      VALID,
    )
    expect(r.details.length).toBe(1000)
    expect(r.missingInfo.length).toBe(8)
  })

  it('phase invalid → none', () => {
    expect(parseQuoteIntent('{"phase":"executing","serviceIds":["q1"]}', VALID).phase).toBe('none')
  })

  it('fallback gol când nu există JSON', () => {
    expect(parseQuoteIntent('nu am putut analiza', VALID)).toEqual({
      phase: 'none', serviceIds: [], details: '', missingInfo: [], customerNote: '',
    })
  })

  it('fallback gol la JSON invalid', () => {
    expect(parseQuoteIntent('{phase: ready, serviceId: }', VALID).phase).toBe('none')
  })
})
