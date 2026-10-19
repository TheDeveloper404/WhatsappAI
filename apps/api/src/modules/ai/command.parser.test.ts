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

  it('/pauseAI plafonat 1–720h și acceptă număr fără „h"', () => {
    expect(parseCommand('/pauseAI 0h')).toEqual({ type: 'pauseAI', hours: 1 })       // 0 → min 1
    expect(parseCommand('/pauseAI 99999h')).toEqual({ type: 'pauseAI', hours: 720 }) // peste plafon → 720
    expect(parseCommand('/pauseAI 5')).toEqual({ type: 'pauseAI', hours: 5 })        // fără „h" → acceptat
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

  it('/block, /unblock, /learnStyle', () => {
    expect(parseCommand('/block')).toEqual({ type: 'block' })
    expect(parseCommand('/unblock')).toEqual({ type: 'unblock' })
    expect(parseCommand('/learnStyle')).toEqual({ type: 'learnStyle' })
  })

  it('/kb fără argument sau show → afișare', () => {
    expect(parseCommand('/kb')).toEqual({ type: 'kb', action: 'show' })
    expect(parseCommand('/kb show')).toEqual({ type: 'kb', action: 'show' })
    expect(parseCommand('/kb clear')).toEqual({ type: 'kb', action: 'clear' })
  })

  it('/kb set|add păstrează textul multi-linie', () => {
    expect(parseCommand('/kb set Program: L-V 9-18\nAdresa: Str. X 1')).toEqual({ type: 'kb', action: 'set', text: 'Program: L-V 9-18\nAdresa: Str. X 1' })
    expect(parseCommand('/kb add   o linie')).toEqual({ type: 'kb', action: 'add', text: 'o linie' })
  })

  it('/kb set|add fără text sau sub-comandă necunoscută → null', () => {
    expect(parseCommand('/kb set')).toBeNull()
    expect(parseCommand('/kb add   ')).toBeNull()
    expect(parseCommand('/kb delete')).toBeNull()
  })

  it('/prompt show|reset|set', () => {
    expect(parseCommand('/prompt')).toEqual({ type: 'prompt', action: 'show' })
    expect(parseCommand('/prompt reset')).toEqual({ type: 'prompt', action: 'reset' })
    expect(parseCommand('/prompt set Răspunde scurt.')).toEqual({ type: 'prompt', action: 'set', text: 'Răspunde scurt.' })
    expect(parseCommand('/prompt set')).toBeNull()
  })

  it('/notify on|off', () => {
    expect(parseCommand('/notify on')).toEqual({ type: 'notify', enabled: true })
    expect(parseCommand('/NOTIFY OFF')).toEqual({ type: 'notify', enabled: false })
    expect(parseCommand('/notify')).toBeNull()
    expect(parseCommand('/notify maybe')).toBeNull()
  })

  it('comenzile de programări din varianta SaaS nu mai există', () => {
    expect(parseCommand('/confirma prg_a1b2c3 18.06 09:00')).toBeNull()
    expect(parseCommand('/anuleaza prg_a1b2c3')).toBeNull()
  })
})
