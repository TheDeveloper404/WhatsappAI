import { describe, it, expect } from 'vitest'
import { parseOrderIntent } from './groq.client.js'

// Testează DOAR validarea output-ului LLM pentru fluxul de comenzi (partea critică).
// Fără rețea. Regula de aur: LLM-ul propune, codul dispune — items invalide se aruncă,
// fazele se retrogradează în cod, banii nu trec niciodată prin LLM.
const VALID = new Set(['p1', 'p2'])

describe('parseOrderIntent', () => {
  it('parsează o comandă „ready" cu produse valide', () => {
    const r = parseOrderIntent(
      '{"phase":"ready","items":[{"productId":"p1","quantity":2}],"details":"fără ceapă","missingInfo":[],"customerNote":"str. Florilor 3"}',
      VALID,
    )
    expect(r.phase).toBe('ready')
    expect(r.items).toEqual([{ productId: 'p1', quantity: 2 }])
    expect(r.details).toBe('fără ceapă')
    expect(r.customerNote).toBe('str. Florilor 3')
  })

  it('extrage JSON împachetat în ```json``` / text', () => {
    const r = parseOrderIntent('```json\n{"phase":"collecting","items":[],"missingInfo":["adresa de livrare"]}\n```', VALID)
    expect(r.phase).toBe('collecting')
    expect(r.missingInfo).toEqual(['adresa de livrare'])
  })

  it('aruncă item-urile cu id în afara catalogului', () => {
    const r = parseOrderIntent(
      '{"phase":"ready","items":[{"productId":"FAKE","quantity":1},{"productId":"p2","quantity":3}],"missingInfo":[]}',
      VALID,
    )
    expect(r.items).toEqual([{ productId: 'p2', quantity: 3 }])
  })

  it('„ready" fără niciun produs valid → retrogradat la „collecting"', () => {
    const r = parseOrderIntent('{"phase":"ready","items":[{"productId":"FAKE","quantity":1}],"missingInfo":["ce produs"]}', VALID)
    expect(r.phase).toBe('collecting')
    expect(r.items).toEqual([])
  })

  it('caz custom-budget („website 3000€"): items gol, rămâne collecting, nu inventează', () => {
    const r = parseOrderIntent(
      '{"phase":"collecting","items":[],"details":"website service auto, buget 3000€","missingInfo":["confirmare preț de la proprietar"]}',
      VALID,
    )
    expect(r.phase).toBe('collecting')
    expect(r.items).toEqual([])
    expect(r.details).toContain('3000')
  })

  it('plafonează cantitatea la 999 și rotunjește în jos', () => {
    const r = parseOrderIntent('{"phase":"ready","items":[{"productId":"p1","quantity":5000.9}],"missingInfo":[]}', VALID)
    expect(r.items[0].quantity).toBe(999)
  })

  it('aruncă item-urile cu cantitate <= 0 sau non-numerică', () => {
    const r = parseOrderIntent(
      '{"phase":"ready","items":[{"productId":"p1","quantity":0},{"productId":"p2","quantity":-3}],"missingInfo":[]}',
      VALID,
    )
    expect(r.items).toEqual([])
    // ready → retrogradat collecting (0 produse), apoi → none (nimic de cerut: fără items,
    // fără missingInfo, fără details). O „comandă" complet goală nu e o comandă.
    expect(r.phase).toBe('none')
  })

  it('cantitate în (0,1) (ex. 0.4) → aruncată, nu lăsată ca 0 (floor înainte de filtru)', () => {
    const r = parseOrderIntent(
      '{"phase":"ready","items":[{"productId":"p1","quantity":0.4}],"missingInfo":[]}',
      VALID,
    )
    // 0.4 > 0 brut, dar floor(0.4)=0 → trebuie aruncat, nu păstrat ca linie „produs ×0".
    expect(r.items).toEqual([])
    // ready fără produse → collecting → none (nimic de cerut).
    expect(r.phase).toBe('none')
  })

  it('cantitate fracționară >= 1 (ex. 1.9) → păstrată, rotunjită în jos la 1', () => {
    const r = parseOrderIntent(
      '{"phase":"ready","items":[{"productId":"p1","quantity":1.9}],"missingInfo":[]}',
      VALID,
    )
    expect(r.items).toEqual([{ productId: 'p1', quantity: 1 }])
    expect(r.phase).toBe('ready')
  })

  it('phase invalid → none', () => {
    expect(parseOrderIntent('{"phase":"executing","items":[],"missingInfo":[]}', VALID).phase).toBe('none')
  })

  it('phase non-none fără produse, fără missingInfo, fără details → none (nu e comandă)', () => {
    expect(parseOrderIntent('{"phase":"collecting","items":[],"missingInfo":[],"details":""}', VALID).phase).toBe('none')
  })

  it('limitează missingInfo la 8 intrări și fiecare la 120 caractere', () => {
    const many = Array.from({ length: 20 }, (_, i) => `"item ${i} ${'x'.repeat(200)}"`).join(',')
    const r = parseOrderIntent(`{"phase":"collecting","items":[],"missingInfo":[${many}]}`, VALID)
    expect(r.missingInfo.length).toBe(8)
    expect(r.missingInfo.every(s => s.length <= 120)).toBe(true)
  })

  it('filtrează intrările goale din missingInfo', () => {
    const r = parseOrderIntent('{"phase":"collecting","items":[],"missingInfo":["",""," ","adresa"]}', VALID)
    expect(r.missingInfo).toEqual(['adresa'])
  })

  it('limitează details la 1000 și customerNote la 500 caractere', () => {
    const r = parseOrderIntent(
      `{"phase":"collecting","items":[],"details":"${'d'.repeat(2000)}","customerNote":"${'n'.repeat(2000)}","missingInfo":["x"]}`,
      VALID,
    )
    expect(r.details.length).toBe(1000)
    expect(r.customerNote.length).toBe(500)
  })

  it('fallback gol când nu există JSON', () => {
    expect(parseOrderIntent('nu am putut analiza', VALID)).toEqual({
      phase: 'none', items: [], details: '', missingInfo: [], customerNote: '', delivery: { method: '', address: '' },
    })
  })

  it('fallback gol la JSON invalid (sintaxă stricată)', () => {
    expect(parseOrderIntent('{phase: ready, items: }', VALID).phase).toBe('none')
  })

  it('items non-array → gol, fără crash', () => {
    expect(parseOrderIntent('{"phase":"none","items":"oops","missingInfo":[]}', VALID).items).toEqual([])
  })

  it('extrage livrarea (metodă + adresă) — B11', () => {
    const r = parseOrderIntent(
      '{"phase":"ready","items":[{"productId":"p1","quantity":1}],"missingInfo":[],"delivery":{"method":"delivery","address":"str. Lalelelor 5, Cluj"}}',
      VALID,
    )
    expect(r.delivery).toEqual({ method: 'delivery', address: 'str. Lalelelor 5, Cluj' })
  })

  it('metodă de livrare invalidă → gol (listă închisă) — B11', () => {
    const r = parseOrderIntent(
      '{"phase":"none","items":[],"missingInfo":[],"delivery":{"method":"drona","address":"x"}}',
      VALID,
    )
    expect(r.delivery.method).toBe('')
    expect(r.delivery.address).toBe('x')
  })
})
