import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import { authenticate } from '../../middleware/authenticate.js'
import { requireActiveSubscription } from '../../middleware/requireSubscription.js'
import { knowledgeService, SUPPORTED_MIMES, UnprocessableDocumentError } from './knowledge.service.js'
import { knowledgeRepository } from './knowledge.repository.js'
import { Errors } from '../../utils/errors.js'
import { logger } from '../../utils/logger.js'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

// Rate limit dezactivat în test/E2E (același pattern ca `rl()` din auth.routes) ca să nu
// interfereze cu suitele care fac multe upload-uri de la același IP.
const uploadRateLimit =
  process.env.NODE_ENV === 'test' || process.env.E2E_MODE === 'true'
    ? {}
    : { config: { rateLimit: { max: 10, timeWindow: '5 minutes' } } }

export async function knowledgeRoutes(app: FastifyInstance) {
  // Multipart scoped pe acest plugin. fileSize taie fișierele prea mari încă de la stream
  // (nu încărcăm 10 GB în RAM); files:1 => un singur fișier per cerere.
  await app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES, files: 1 } })

  // Upload + indexare document. Rate limit (în prod): embedding-urile costă, deci plafonăm.
  app.post('/documents', {
    ...uploadRateLimit,
    preHandler: [authenticate, requireActiveSubscription],
  }, async (req, reply) => {
    const data = await req.file()
    if (!data) throw Errors.unprocessable('Niciun fișier primit.')

    // MIME-ul vine de la client (poate fi falsificat) — e doar prima poartă. Garanția reală e că
    // parserul (pdf/docx) operează pe bytes-ii efectivi: un fișier care minte tipul eșuează la extragere.
    if (!SUPPORTED_MIMES.has(data.mimetype)) {
      throw Errors.unprocessable('Tip de fișier nesuportat. Acceptăm PDF, DOCX sau TXT.')
    }

    let buffer: Buffer
    try {
      buffer = await data.toBuffer()
    } catch {
      // @fastify/multipart aruncă dacă s-a depășit fileSize în timpul citirii stream-ului.
      throw Errors.unprocessable('Fișier prea mare (max 10 MB).')
    }

    try {
      const document = await knowledgeService.ingest(
        req.user!.id,
        data.filename || 'document',
        data.mimetype,
        buffer,
      )
      // Fără nume fișier / conținut în logs — doar metadate de diagnostic.
      logger.info(`[knowledge][${req.user!.id.slice(0, 8)}] document indexat`, { mime: data.mimetype, chars: document.charCount })
      return reply.code(201).send({ document })
    } catch (err) {
      if (err instanceof UnprocessableDocumentError) throw Errors.unprocessable(err.message)
      throw err
    }
  })

  app.get('/documents', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const documents = await knowledgeRepository.list(req.user!.id)
    return reply.send({ documents })
  })

  app.delete('/documents/:id', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    // Scoped pe userId: confirmăm proprietatea înainte de ștergere (anti-IDOR).
    const existing = await knowledgeRepository.findById(req.user!.id, id)
    if (!existing) throw Errors.notFound('Document')
    await knowledgeRepository.delete(req.user!.id, id)
    return reply.code(204).send()
  })
}
