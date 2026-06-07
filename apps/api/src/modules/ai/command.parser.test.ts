import { describe, it, expect } from 'vitest'
import { parseCommand } from './command.parser.js'

describe('parseCommand', () => {
  it('returnează null pentru mesaje fără /', () => {
    expect(parseCommand('salut')).toBeNull()
    expect(parseCommand('')).toBeNull()
    expect(parseCommand('activateAI')).toBeNull()
  })

  it('returnează null pentru comenzi necunoscute', () => {
    expect(parseCommand('/unknown')).toBeNull()
    expect(parseCommand('/start')).toBeNull()
  })

  it('/activateAI', () => {
    expect(parseCommand('/activateAI')).toEqual({ type: 'activateAI' })
    expect(parseCommand('/ACTIVATEAI')).toEqual({ type: 'activateAI' })
    expect(parseCommand('/activateai ')).toEqual({ type: 'activateAI' })
  })

  it('/deactivateAI', () => {
    expect(parseCommand('/deactivateAI')).toEqual({ type: 'deactivateAI' })
    expect(parseCommand('/DEACTIVATEAI')).toEqual({ type: 'deactivateAI' })
  })

  it('/resumeAI este alias pentru activateAI', () => {
    expect(parseCommand('/resumeAI')).toEqual({ type: 'activateAI' })
  })

  it('/status', () => {
    expect(parseCommand('/status')).toEqual({ type: 'status' })
  })

  it('/help', () => {
    expect(parseCommand('/help')).toEqual({ type: 'help' })
  })

  it('/pauseAI cu ore specificate', () => {
    expect(parseCommand('/pauseAI 2h')).toEqual({ type: 'pauseAI', hours: 2 })
    expect(parseCommand('/pauseAI 10h')).toEqual({ type: 'pauseAI', hours: 10 })
    expect(parseCommand('/pauseAI 1H')).toEqual({ type: 'pauseAI', hours: 1 })
  })

  it('/pauseAI fără argument folosește 1h implicit', () => {
    expect(parseCommand('/pauseAI')).toEqual({ type: 'pauseAI', hours: 1 })
    expect(parseCommand('/pauseAI invalid')).toEqual({ type: 'pauseAI', hours: 1 })
  })

  it('/setTimer cu număr valid', () => {
    expect(parseCommand('/setTimer 5')).toEqual({ type: 'setTimer', minutes: 5 })
    expect(parseCommand('/setTimer 5min')).toEqual({ type: 'setTimer', minutes: 5 })
    expect(parseCommand('/setTimer 10MIN')).toEqual({ type: 'setTimer', minutes: 10 })
    expect(parseCommand('/SETTIMER 30')).toEqual({ type: 'setTimer', minutes: 30 })
  })

  it('/setTimer fără argument sau invalid returnează null', () => {
    expect(parseCommand('/setTimer')).toBeNull()
    expect(parseCommand('/setTimer 0')).toBeNull()
    expect(parseCommand('/setTimer 61')).toBeNull()
    expect(parseCommand('/setTimer abc')).toBeNull()
  })

  it('/clearHistory returnează { type: clearHistory } indiferent de argument', () => {
    expect(parseCommand('/clearHistory')).toEqual({ type: 'clearHistory' })
    expect(parseCommand('/clearHistory +40758154490')).toEqual({ type: 'clearHistory' })
    expect(parseCommand('/clearHistory 40758154490')).toEqual({ type: 'clearHistory' })
  })

  // Comenzi programări owner (#6)
  it('/confirma cu ref valid', () => {
    expect(parseCommand('/confirma prg_a1b2c3')).toEqual({ type: 'confirmBooking', ref: 'prg_a1b2c3' })
    expect(parseCommand('/CONFIRMA prg_A1B2C3')).toEqual({ type: 'confirmBooking', ref: 'prg_A1B2C3' })
  })

  it('/anuleaza și /finalizeaza cu ref valid', () => {
    expect(parseCommand('/anuleaza prg_abc123')).toEqual({ type: 'cancelBooking', ref: 'prg_abc123' })
    expect(parseCommand('/finalizeaza prg_abc123')).toEqual({ type: 'completeBooking', ref: 'prg_abc123' })
  })

  it('tolerează diacriticele în numele comenzii', () => {
    expect(parseCommand('/confirmă prg_a1b2c3')).toEqual({ type: 'confirmBooking', ref: 'prg_a1b2c3' })
    expect(parseCommand('/anulează prg_a1b2c3')).toEqual({ type: 'cancelBooking', ref: 'prg_a1b2c3' })
  })

  it('returnează null pentru ref lipsă sau invalid', () => {
    expect(parseCommand('/confirma')).toBeNull()
    expect(parseCommand('/confirma abc123')).toBeNull()
    expect(parseCommand('/confirma ord_a1b2c3')).toBeNull()
    expect(parseCommand('/anuleaza prg_')).toBeNull()
  })
})
