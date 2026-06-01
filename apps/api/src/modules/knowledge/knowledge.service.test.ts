import { describe, it, expect } from 'vitest'
import { chunkText, cosineSimilarity } from './knowledge.service.js'

describe('chunkText', () => {
  it('text gol → fără chunks', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n\n  ')).toEqual([])
  })

  it('text scurt → un singur chunk, normalizat', () => {
    const chunks = chunkText('Salut.   Acesta   e   un   test.')
    expect(chunks).toHaveLength(1)
    // Spațiile multiple sunt colapsate.
    expect(chunks[0]).toBe('Salut. Acesta e un test.')
  })

  it('paragrafe multiple grupate sub limita de chunk', () => {
    const chunks = chunkText('Paragraf unu.\n\nParagraf doi.\n\nParagraf trei.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toContain('Paragraf unu.')
    expect(chunks[0]).toContain('Paragraf trei.')
  })

  it('paragraf foarte lung → tăiat în mai multe chunks', () => {
    const long = 'a'.repeat(5000)
    const chunks = chunkText(long)
    expect(chunks.length).toBeGreaterThan(1)
    // Fiecare chunk nu depășește limita (2000 caractere).
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(2000)
  })
})

describe('cosineSimilarity', () => {
  it('vectori identici → 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5)
  })

  it('vectori ortogonali → 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0)
  })

  it('vector nul → 0 (fără diviziune prin zero)', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0)
  })

  it('lungimi diferite → 0 (defensiv)', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
  })
})
