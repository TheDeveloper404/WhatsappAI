import { describe, it, expect } from 'vitest'
import {
  validateWorkingHours, serializeWorkingHours, parseWorkingHours,
  checkWeekdayTime, describeDayRo, type WorkingHours,
} from './working-hours.js'

// Modul de domeniu pur (0.5.3): sursa de adevăr a guard-ului de program. Fără rețea.
// Filozofie: LLM-ul extrage slotul, validarea e DETERMINISTĂ aici.

describe('validateWorkingHours', () => {
  it('acceptă un program valid și normalizează orele (zero-padding)', () => {
    const wh = validateWorkingHours({ mon: { open: '9:00', close: '18:00' }, sun: null })
    expect(wh.mon).toEqual({ open: '09:00', close: '18:00' })
    expect(wh.sun).toBeNull()
  })

  it('respinge zi necunoscută', () => {
    expect(() => validateWorkingHours({ luni: { open: '09:00', close: '18:00' } })).toThrow(/zi necunoscută/i)
  })

  it('respinge oră în format greșit', () => {
    expect(() => validateWorkingHours({ mon: { open: '9 dimineața', close: '18:00' } })).toThrow(/HH:MM/)
  })

  it('respinge deschidere ≥ închidere', () => {
    expect(() => validateWorkingHours({ sat: { open: '14:00', close: '13:00' } })).toThrow(/înainte de cea de închidere/i)
  })

  it('respinge input non-obiect', () => {
    expect(() => validateWorkingHours('luni-vineri')).toThrow(/obiect/i)
    expect(() => validateWorkingHours([])).toThrow(/obiect/i)
  })
})

describe('serializeWorkingHours / parseWorkingHours', () => {
  it('round-trip păstrează structura', () => {
    const wh: WorkingHours = { mon: { open: '09:00', close: '18:00' }, sat: { open: '09:00', close: '13:00' }, sun: null }
    expect(parseWorkingHours(serializeWorkingHours(wh))).toEqual(wh)
  })

  it('obiect gol serializează la "" (neconfigurat)', () => {
    expect(serializeWorkingHours({})).toBe('')
  })

  it('citire tolerantă: gol / corupt / invalid → null (fail-open)', () => {
    expect(parseWorkingHours('')).toBeNull()
    expect(parseWorkingHours(undefined)).toBeNull()
    expect(parseWorkingHours('{ nu e json')).toBeNull()
    expect(parseWorkingHours('{"xyz":{"open":"09:00","close":"18:00"}}')).toBeNull()
  })
})

describe('checkWeekdayTime (guard 0.5.3)', () => {
  const wh: WorkingHours = { sat: { open: '09:00', close: '13:00' }, mon: { open: '09:00', close: '18:00' }, sun: null }

  it('respinge ora după închidere (bug-ul din transcript: sâmbătă 14:00, închide 13:00)', () => {
    expect(checkWeekdayTime(wh, 'sat', '14:00')).toEqual({ ok: false, reason: 'outside_hours', day: 'sat' })
  })

  it('respinge o zi închisă', () => {
    expect(checkWeekdayTime(wh, 'sun', '11:00')).toEqual({ ok: false, reason: 'closed_day', day: 'sun' })
  })

  it('respinge o zi nedefinită în program (lipsă cheie = închis)', () => {
    expect(checkWeekdayTime(wh, 'tue', '11:00')).toEqual({ ok: false, reason: 'closed_day', day: 'tue' })
  })

  it('acceptă un slot în interval', () => {
    expect(checkWeekdayTime(wh, 'sat', '11:30')).toEqual({ ok: true })
    expect(checkWeekdayTime(wh, 'mon', '09:00')).toEqual({ ok: true }) // exact la deschidere = ok
  })

  it('ora de închidere exactă e în afara programului (interval [open, close))', () => {
    expect(checkWeekdayTime(wh, 'sat', '13:00')).toEqual({ ok: false, reason: 'outside_hours', day: 'sat' })
  })

  it('fail-open: program neconfigurat (null) → ok', () => {
    expect(checkWeekdayTime(null, 'sat', '14:00')).toEqual({ ok: true })
  })

  it('fail-open: oră ne-parsabilă → ok (nu blocăm pe date proaste)', () => {
    expect(checkWeekdayTime(wh, 'sat', 'după-amiază')).toEqual({ ok: true })
  })
})

describe('describeDayRo', () => {
  const wh: WorkingHours = { sat: { open: '09:00', close: '13:00' }, sun: null }
  it('descrie o zi lucrătoare', () => {
    expect(describeDayRo(wh, 'sat')).toBe('Sâmbătă lucrăm 09:00–13:00')
  })
  it('descrie o zi închisă', () => {
    expect(describeDayRo(wh, 'sun')).toBe('Duminică este zi închisă')
  })
})
