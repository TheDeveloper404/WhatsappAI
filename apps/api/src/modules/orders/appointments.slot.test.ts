import { describe, it, expect } from 'vitest'
import { parseSlotToEpoch } from './appointments.service.js'

// Formatează un epoch în ora RO (wall-clock), ca să verificăm că parsarea a interpretat corect tz-ul.
function roWall(ts: number): string {
  return new Intl.DateTimeFormat('ro-RO', {
    timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(ts))
}

const NOW_2026 = Date.UTC(2026, 0, 1) // an de referință pt când nu se dă anul

describe('parseSlotToEpoch — dată+oră ca ora României', () => {
  it('„18.06 09:00" → 18 iunie, 09:00 ora RO (vara, UTC+3)', () => {
    const ts = parseSlotToEpoch('18.06 09:00', NOW_2026)
    expect(ts).not.toBeNull()
    expect(roWall(ts!)).toBe('18.06, 09:00')
  })

  it('iarna (UTC+2): „15.01 08:30"', () => {
    const ts = parseSlotToEpoch('15.01 08:30', NOW_2026)
    expect(ts).not.toBeNull()
    expect(roWall(ts!)).toBe('15.01, 08:30')
  })

  it('acceptă anul explicit și separatori / sau -', () => {
    expect(parseSlotToEpoch('18/06/2026 9:00', NOW_2026)).not.toBeNull()
    expect(parseSlotToEpoch('18-06 09:00', NOW_2026)).not.toBeNull()
  })

  it('respinge format invalid sau dată imposibilă', () => {
    expect(parseSlotToEpoch('mâine dimineață', NOW_2026)).toBeNull()
    expect(parseSlotToEpoch('18.06', NOW_2026)).toBeNull()       // fără oră
    expect(parseSlotToEpoch('31.02 09:00', NOW_2026)).toBeNull() // 31 februarie nu există
    expect(parseSlotToEpoch('18.13 09:00', NOW_2026)).toBeNull() // luna 13
    expect(parseSlotToEpoch('18.06 25:00', NOW_2026)).toBeNull() // ora 25
  })
})
