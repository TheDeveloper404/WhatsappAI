import { describe, it, expect } from 'vitest'
import { startOfDayInTz, startOfMonthInTz } from './ai.repository.js'

// Regresie DST (0.2): granițele de „azi"/„lună" pentru statistici trebuie să cadă pe miezul nopții
// LOCAL (Europe/Bucharest), inclusiv pe zilele de tranziție. Bug-ul vechi lua offset-ul la `now`,
// nu la miezul nopții candidat → ±1h greșit de 2 ori pe an. Verificăm prin epoch UTC așteptat.
const TZ = 'Europe/Bucharest'
const iso = (ms: number) => new Date(ms).toISOString()

describe('startOfDayInTz — corect pe tranzițiile DST', () => {
  it('spring-forward (2026-03-29): miezul nopții local = 28T22:00Z (EET +2)', () => {
    // `now` = prânz, deja în EEST (+3); miezul nopții e încă EET (+2).
    expect(iso(startOfDayInTz(Date.UTC(2026, 2, 29, 12), TZ))).toBe('2026-03-28T22:00:00.000Z')
  })

  it('fall-back (2026-10-25): miezul nopții local = 24T21:00Z (EEST +3)', () => {
    // `now` = prânz, deja în EET (+2); miezul nopții e încă EEST (+3).
    expect(iso(startOfDayInTz(Date.UTC(2026, 9, 25, 12), TZ))).toBe('2026-10-24T21:00:00.000Z')
  })

  it('zi normală de vară (2026-06-10): miezul nopții = 09T21:00Z (EEST +3)', () => {
    expect(iso(startOfDayInTz(Date.UTC(2026, 5, 10, 12), TZ))).toBe('2026-06-09T21:00:00.000Z')
  })

  it('zi normală de iarnă (2026-01-15): miezul nopții = 14T22:00Z (EET +2)', () => {
    expect(iso(startOfDayInTz(Date.UTC(2026, 0, 15, 12), TZ))).toBe('2026-01-14T22:00:00.000Z')
  })
})

describe('startOfMonthInTz — corect chiar dacă `now` e de cealaltă parte a DST față de ziua 1', () => {
  it('octombrie: now după fall-back → 1 oct rămâne EEST (+3) = 30 sep 21:00Z', () => {
    // 1 oct e EEST(+3); `now`=30 oct e EET(+2). Bug-ul vechi ar fi dat 22:00Z (offset la now).
    expect(iso(startOfMonthInTz(Date.UTC(2026, 9, 30, 12), TZ))).toBe('2026-09-30T21:00:00.000Z')
  })

  it('martie: now după spring-forward → 1 mar rămâne EET (+2) = 28 feb 22:00Z', () => {
    expect(iso(startOfMonthInTz(Date.UTC(2026, 2, 30, 12), TZ))).toBe('2026-02-28T22:00:00.000Z')
  })
})
