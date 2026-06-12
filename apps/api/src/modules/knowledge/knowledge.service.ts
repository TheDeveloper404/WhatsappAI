import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import { embedTexts } from '../ai/groq.client.js'
import { knowledgeRepository, type ChunkInput } from './knowledge.repository.js'
import { userTier, ragChunkLimit } from '../billing/entitlement.js'
import { AppError } from '../../utils/errors.js'
import type { Document } from '../../db/schema.js'

// MIME-uri acceptate. Validarea „hard" (whitelist + mărime) se face în rută; aici e dublată defensiv.
export const SUPPORTED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
])

const CHUNK_SIZE = 2000        // caractere per chunk (~500 tokens)
const CHUNK_OVERLAP = 200      // suprapunere ca să nu tăiem o frază relevantă fix la graniță
const MAX_CHUNKS = 400         // plafon per document (anti-abuz; ~800k caractere)
// Plafon TOTAL fragmente per user (L17) — mărginește costul O(n) al RAG/mesaj. Per tier (Etapa 2.2a,
// pas 3): Pro 500 / Max 2.000, din `entitlement.ragChunkLimit`. MAX_EXTRACTED_CHARS folosește MAX_CHUNKS,
// nu acest plafon, deci anti-DoS-ul la parsing rămâne neschimbat.
const MIN_TEXT_LEN = 20        // sub atât = document fără conținut util → respins
const RETRIEVE_TOP_K = 3
const RETRIEVE_MIN_SCORE = 0.5 // prag cosine: sub atât considerăm irelevant și nu injectăm

// Anti-DoS la parsing (M4). Un docx/pdf de 10 MB comprimat poate „exploda" la GB de text în RAM
// (zip-bomb). Plafonăm textul extras (aliniat cu capacitatea de chunking — peste atât oricum n-am
// indexa) și punem un timeout pe parsing ca să nu blocăm cererea la nesfârșit.
const MAX_EXTRACTED_CHARS = MAX_CHUNKS * CHUNK_SIZE  // 800k — peste asta chunking-ul oricum ar tăia
const EXTRACT_TIMEOUT_MS = 20_000

// Eroare „de input" (text neextractibil / tip nesuportat) — ruta o mapează la 4xx, nu 500.
export class UnprocessableDocumentError extends Error {}

// Rulează un parsing cu timeout. NB: pe parsing pur-sincron (CPU-bound) timer-ul se declanșează doar
// în pauzele async; mammoth (jszip) și pdf-parse au porțiuni async, deci timeout-ul prinde hang-urile.
// Pentru protecție totală contra blocării event-loop-ului ar fi nevoie de worker thread (vezi M4 în audit).
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new UnprocessableDocumentError(`${label} a depășit timpul limită (${ms / 1000}s).`)),
      ms,
    )
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

// Extrage text brut după tip. NU scrie nimic pe disc — totul în memorie.
async function extractText(buffer: Buffer, mime: string): Promise<string> {
  if (mime === 'application/pdf') {
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      return result.text
    } finally {
      await parser.destroy().catch(() => {})
    }
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const { value } = await mammoth.extractRawText({ buffer })
    return value
  }
  if (mime === 'text/plain') {
    // Plafon la nivel de bytes înainte de decodare (cheap; upload-ul e deja ≤10 MB).
    return buffer.subarray(0, MAX_EXTRACTED_CHARS).toString('utf8')
  }
  throw new UnprocessableDocumentError(`Tip de fișier nesuportat: ${mime}`)
}

// Normalizează spațiile și împarte textul în chunks pe granițe de paragraf, cu overlap.
// Paragrafele prea lungi se taie „hard" pe caractere.
export function chunkText(raw: string): string[] {
  const text = raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!text) return []

  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  const pushCurrent = () => {
    const c = current.trim()
    if (c) chunks.push(c)
    current = ''
  }

  for (const para of paragraphs) {
    // Paragraf mai lung decât un chunk: taie-l în bucăți cu overlap.
    if (para.length > CHUNK_SIZE) {
      pushCurrent()
      for (let i = 0; i < para.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        chunks.push(para.slice(i, i + CHUNK_SIZE).trim())
        if (chunks.length >= MAX_CHUNKS) return chunks
      }
      continue
    }
    if (current.length + para.length + 2 > CHUNK_SIZE) pushCurrent()
    current += (current ? '\n\n' : '') + para
    if (chunks.length >= MAX_CHUNKS) return chunks
  }
  pushCurrent()
  return chunks.slice(0, MAX_CHUNKS)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export const knowledgeService = {
  // Pipeline complet: extrage → chunk → embed → store. Aruncă UnprocessableDocumentError dacă
  // documentul n-are text util. Embedding-ul e RETRIEVAL_DOCUMENT (rolul corect la indexare).
  async ingest(userId: string, filename: string, mime: string, buffer: Buffer): Promise<Document> {
    if (!SUPPORTED_MIMES.has(mime)) throw new UnprocessableDocumentError(`Tip de fișier nesuportat: ${mime}`)

    // Parsing cu timeout (M4) + plafon pe textul extras înainte de chunking/embedding.
    const extracted = await withTimeout(extractText(buffer, mime), EXTRACT_TIMEOUT_MS, 'Procesarea documentului')
    const text = extracted.length > MAX_EXTRACTED_CHARS ? extracted.slice(0, MAX_EXTRACTED_CHARS) : extracted
    const chunks = chunkText(text)
    if (chunks.length === 0 || text.trim().length < MIN_TEXT_LEN) {
      throw new UnprocessableDocumentError('Nu am putut extrage text util din document (gol sau scanat?).')
    }

    // Plafon total per user (L17) — verificat ÎNAINTE de embedding (costul real), ca să nu lăsăm
    // un user să umfle baza de cunoștințe și să încarce retrieval-ul pe fiecare mesaj. Per tier
    // (fail-closed: legacy/null → limita Pro).
    const maxUserChunks = ragChunkLimit(await userTier(userId))
    const existingChunks = await knowledgeRepository.countChunksForUser(userId)
    if (existingChunks + chunks.length > maxUserChunks) {
      throw new UnprocessableDocumentError(`Ai atins limita bazei de cunoștințe (${maxUserChunks} fragmente) a planului tău. Șterge documente vechi sau treci pe Max pentru mai mult spațiu.`)
    }

    let vectors: number[][]
    try {
      vectors = await embedTexts(chunks, 'RETRIEVAL_DOCUMENT')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new AppError(503, 'EMBEDDING_UNAVAILABLE', `Serviciul de embedding nu este disponibil: ${msg}`)
    }
    const chunkInputs: ChunkInput[] = chunks.map((content, i) => ({
      chunkIndex: i,
      content,
      embedding: vectors[i],
    }))

    return knowledgeRepository.create(userId, filename, mime, text.trim().length, chunkInputs)
  },

  // Întoarce conținutul celor mai relevante chunks pentru o întrebare (scoped pe userId).
  // Gol dacă nu există documente sau nimic nu trece pragul de relevanță.
  async retrieve(userId: string, query: string, topK = RETRIEVE_TOP_K): Promise<string[]> {
    const q = query.trim()
    if (!q) return []

    const all = await knowledgeRepository.listChunksForUser(userId)
    if (all.length === 0) return []

    let queryVec: number[] | undefined
    try {
      ;[queryVec] = await embedTexts([q], 'RETRIEVAL_QUERY')
    } catch {
      return []  // fail-open la retrieve: fără embedding = răspuns fără RAG, nu eroare
    }
    if (!queryVec) return []

    return all
      .map(c => ({ content: c.content, score: cosineSimilarity(queryVec, c.embedding) }))
      .filter(c => c.score >= RETRIEVE_MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(c => c.content)
  },
}
