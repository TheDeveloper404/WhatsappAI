import { describe, it, expect } from 'vitest'
import { parseLeadClassification } from './groq.client.js'

// Testează DOAR validarea output-ului LLM (partea critică de securitate). Fără rețea.
describe('parseLeadClassification', () => {
  it('parsează JSON valid', () => {
    const r = parseLeadClassification('{"status":"hot","score":85,"reason":"vrea să comande acum"}')
    expect(r).toEqual({ status: 'hot', score: 85, reason: 'vrea să comande acum' })
  })

  it('extrage JSON împachetat în ```json``` / text', () => {
    const r = parseLeadClassification('```json\n{"status":"warm","score":50,"reason":"se informează"}\n```')
    expect(r.status).toBe('warm')
    expect(r.score).toBe(50)
  })

  it('plafonează scorul peste 100', () => {
    const r = parseLeadClassification('{"status":"hot","score":999,"reason":"x"}')
    expect(r.score).toBe(100)
  })

  it('plafonează scorul negativ la 0', () => {
    const r = parseLeadClassification('{"status":"cold","score":-50,"reason":"x"}')
    expect(r.score).toBe(0)
  })

  it('rotunjește scorul fracționar', () => {
    expect(parseLeadClassification('{"status":"warm","score":49.7,"reason":""}').score).toBe(50)
  })

  it('derivă status-ul din scor când status lipsește', () => {
    expect(parseLeadClassification('{"score":80,"reason":""}').status).toBe('hot')
    expect(parseLeadClassification('{"score":40,"reason":""}').status).toBe('warm')
    expect(parseLeadClassification('{"score":10,"reason":""}').status).toBe('cold')
  })

  it('derivă status-ul din scor când status e invalid', () => {
    expect(parseLeadClassification('{"status":"super-hot","score":90,"reason":""}').status).toBe('hot')
  })

  it('limitează reason la 300 caractere', () => {
    const long = 'a'.repeat(500)
    expect(parseLeadClassification(`{"status":"hot","score":90,"reason":"${long}"}`).reason.length).toBe(300)
  })

  it('reason non-string → string gol', () => {
    expect(parseLeadClassification('{"status":"hot","score":90,"reason":123}').reason).toBe('')
  })

  it('fallback cold/0 când nu există JSON', () => {
    expect(parseLeadClassification('nu am putut clasifica')).toEqual({ status: 'cold', score: 0, reason: '' })
  })

  it('fallback cold/0 la JSON invalid (sintaxă stricată)', () => {
    expect(parseLeadClassification('{status: hot, score: }')).toEqual({ status: 'cold', score: 0, reason: '' })
  })

  it('scor lipsă → 0, status derivat cold', () => {
    const r = parseLeadClassification('{"status":"","reason":"nimic"}')
    expect(r.score).toBe(0)
    expect(r.status).toBe('cold')
  })
})
