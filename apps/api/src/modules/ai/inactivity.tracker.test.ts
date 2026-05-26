import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { recordOwnerReply, isOwnerActive } from './inactivity.tracker.js'

describe('inactivity tracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returnează false când nu există niciun reply înregistrat', () => {
    expect(isOwnerActive('user-1', 'contact-new', 5)).toBe(false)
  })

  it('returnează true imediat după un reply', () => {
    recordOwnerReply('user-1', 'contact-1')
    expect(isOwnerActive('user-1', 'contact-1', 5)).toBe(true)
  })

  it('returnează true în interiorul ferestrei de timp', () => {
    recordOwnerReply('user-1', 'contact-2')
    vi.advanceTimersByTime(4 * 60 * 1000) // 4 minute
    expect(isOwnerActive('user-1', 'contact-2', 5)).toBe(true)
  })

  it('returnează false după expirarea ferestrei de timp', () => {
    recordOwnerReply('user-1', 'contact-3')
    vi.advanceTimersByTime(5 * 60 * 1000 + 1) // 5 minute + 1ms
    expect(isOwnerActive('user-1', 'contact-3', 5)).toBe(false)
  })

  it('respectă timer-ul configurabil', () => {
    recordOwnerReply('user-1', 'contact-4')
    vi.advanceTimersByTime(9 * 60 * 1000) // 9 minute
    expect(isOwnerActive('user-1', 'contact-4', 10)).toBe(true)
    expect(isOwnerActive('user-1', 'contact-4', 5)).toBe(false)
  })

  it('useri diferiți nu interferează', () => {
    recordOwnerReply('user-A', 'contact-x')
    expect(isOwnerActive('user-A', 'contact-x', 5)).toBe(true)
    expect(isOwnerActive('user-B', 'contact-x', 5)).toBe(false)
  })

  it('contacte diferite pentru același user nu interferează', () => {
    recordOwnerReply('user-1', 'contact-alpha')
    expect(isOwnerActive('user-1', 'contact-alpha', 5)).toBe(true)
    expect(isOwnerActive('user-1', 'contact-beta', 5)).toBe(false)
  })

  it('un reply nou resetează timer-ul', () => {
    recordOwnerReply('user-1', 'contact-5')
    vi.advanceTimersByTime(4 * 60 * 1000) // 4 minute
    recordOwnerReply('user-1', 'contact-5') // reply nou
    vi.advanceTimersByTime(4 * 60 * 1000) // încă 4 minute (total 8)
    expect(isOwnerActive('user-1', 'contact-5', 5)).toBe(true)
  })
})
