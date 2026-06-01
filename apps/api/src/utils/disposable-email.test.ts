import { describe, it, expect } from 'vitest'
import { isDisposableEmail } from './disposable-email.js'

describe('isDisposableEmail', () => {
  it('blochează domeniile observate în spam-ul real', () => {
    expect(isDisposableEmail('spam@mailinator.com')).toBe(true)
    expect(isDisposableEmail('waai-pentest-123@guerrillamailblock.com')).toBe(true)
    expect(isDisposableEmail('user@wshu.net')).toBe(true)
  })

  it('blochează alți furnizori populari de email temporar', () => {
    expect(isDisposableEmail('x@10minutemail.com')).toBe(true)
    expect(isDisposableEmail('x@yopmail.com')).toBe(true)
    expect(isDisposableEmail('x@temp-mail.org')).toBe(true)
  })

  it('permite emailuri legitime', () => {
    expect(isDisposableEmail('contact@waai.ro')).toBe(false)
    expect(isDisposableEmail('ana@gmail.com')).toBe(false)
    expect(isDisposableEmail('office@acl-smartsoftware.ro')).toBe(false)
    expect(isDisposableEmail('john@company.co.uk')).toBe(false)
  })

  it('e case-insensitive pe domeniu', () => {
    expect(isDisposableEmail('X@MailInator.com')).toBe(true)
  })

  it('nu crapă pe input fără @', () => {
    expect(isDisposableEmail('not-an-email')).toBe(false)
    expect(isDisposableEmail('')).toBe(false)
  })
})
