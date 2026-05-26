import { describe, it, expect } from 'vitest'
import { detectSentiment } from './message.handler.js'

describe('detectSentiment', () => {
  it('returnează normal pentru mesaje obișnuite', () => {
    expect(detectSentiment('Bună ziua, am o întrebare')).toBe('normal')
    expect(detectSentiment('Salut!')).toBe('normal')
    expect(detectSentiment('Mulțumesc pentru ajutor')).toBe('normal')
    expect(detectSentiment('')).toBe('normal')
  })

  it('detectează urgent prin cuvinte cheie — variante fără diacritice', () => {
    expect(detectSentiment('E urgent, vă rog!')).toBe('urgent')
    expect(detectSentiment('Am nevoie urgenta de raspuns')).toBe('urgent')
    expect(detectSentiment('Trebuie imediat rezolvat')).toBe('urgent')
    expect(detectSentiment('ASAP please')).toBe('urgent')
    expect(detectSentiment('In graba mare')).toBe('urgent')
    expect(detectSentiment('Repede, e important')).toBe('urgent')
    expect(detectSentiment('Acum trebuie să rezolvăm')).toBe('urgent')
  })

  it('detectează urgent prin cuvinte cheie — variante cu diacritice', () => {
    expect(detectSentiment('E urgentă situația')).toBe('urgent')
    expect(detectSentiment('Am o grabă mare')).toBe('urgent')
  })

  it('detectează urgent prin !! (două sau mai multe semne de exclamare)', () => {
    expect(detectSentiment('Vreau răspuns!!')).toBe('urgent')
    expect(detectSentiment('Nu merge!!!')).toBe('urgent')
    expect(detectSentiment('Ajutor!!!!!')).toBe('urgent')
  })

  it('un singur ! nu declanșează urgent', () => {
    expect(detectSentiment('Salut!')).toBe('normal')
    expect(detectSentiment('Bine!')).toBe('normal')
  })

  it('detectează frustrated prin cuvinte cheie — variante fără diacritice', () => {
    expect(detectSentiment('Sunt nemultumit de serviciu')).toBe('frustrated')
    expect(detectSentiment('Sunt suparat pe situatie')).toBe('frustrated')
    expect(detectSentiment('Sunt dezamagit total')).toBe('frustrated')
    expect(detectSentiment('Fac scandal dacă nu rezolvați')).toBe('frustrated')
    expect(detectSentiment('Vreau să depun o reclamatie')).toBe('frustrated')
    expect(detectSentiment('Nu merge aplicatia')).toBe('frustrated')
    expect(detectSentiment('Nu functioneaza deloc')).toBe('frustrated')
    expect(detectSentiment('E ingrozitor ce se întâmplă')).toBe('frustrated')
    expect(detectSentiment('E o catastrofa')).toBe('frustrated')
  })

  it('detectează frustrated prin cuvinte cheie — variante cu diacritice', () => {
    expect(detectSentiment('Sunt nemulțumit de răspuns')).toBe('frustrated')
    expect(detectSentiment('Sunt supărat')).toBe('frustrated')
    expect(detectSentiment('Sunt dezamăgit')).toBe('frustrated')
    expect(detectSentiment('Depun o reclamație formală')).toBe('frustrated')
    expect(detectSentiment('Nu funcționează nimic')).toBe('frustrated')
    expect(detectSentiment('E îngrozitor')).toBe('frustrated')
    expect(detectSentiment('Catastrofă totală')).toBe('frustrated')
  })

  it('urgent are prioritate față de frustrated când ambele sunt prezente', () => {
    expect(detectSentiment('Sunt nemultumit si trebuie rezolvat imediat')).toBe('urgent')
    expect(detectSentiment('Scandal!! E urgent!!')).toBe('urgent')
  })

  it('detecție case-insensitive', () => {
    expect(detectSentiment('URGENT')).toBe('urgent')
    expect(detectSentiment('Urgent')).toBe('urgent')
    expect(detectSentiment('NEMULTUMIT')).toBe('frustrated')
  })
})
