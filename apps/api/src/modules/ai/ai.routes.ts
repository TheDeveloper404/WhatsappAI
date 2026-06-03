import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireActiveSubscription } from '../../middleware/requireSubscription.js'
import { userHasEntitlement } from '../billing/entitlement.js'
import { aiService } from './ai.service.js'
import { Errors } from '../../utils/errors.js'
import { appEvents } from '../../utils/events.js'
import { createStreamToken, verifyStreamToken } from '../../utils/tokens.js'
import { acquireSseSlot, releaseSseSlot } from './sse.connection-limiter.js'

export async function aiRoutes(app: FastifyInstance) {
  app.get('/settings', { preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const settings = await aiService.getSettings(req.user!.id)
    return reply.send({ settings })
  })

  app.patch('/settings', { preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const schema = z.object({
      isActive: z.boolean().optional(),
      timerMinutes: z.number().int().min(1).max(60).optional(),
      systemPrompt: z.string().min(10).max(2000).optional(),
      knowledgeBase: z.string().max(5000).optional(),
      writingStyle: z.string().max(2000).optional(),
      notifyOnAiTakeover: z.boolean().optional(),
      leadCriteria: z.string().max(2000).optional(),
      currency: z.enum(['RON', 'EUR', 'USD', 'GBP']).optional(),
      orderIntakePrompt: z.string().max(2000).optional(),
    })
    const result = schema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: String(e.path[0]), message: e.message })))
    const settings = await aiService.updateSettings(req.user!.id, result.data)
    return reply.send({ settings })
  })

  app.post('/analyze-style', { config: { rateLimit: { max: 3, timeWindow: '1 minute' } }, preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const writingStyle = await aiService.analyzeAndSaveWritingStyle(req.user!.id)
    return reply.send({ writingStyle })
  })

  app.get('/blacklist', { preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const phones = await aiService.getBlacklist(req.user!.id)
    return reply.send({ phones })
  })

  app.post('/blacklist', { preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const schema = z.object({ phoneNumber: z.string().min(7).max(20) })
    const result = schema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: String(e.path[0]), message: e.message })))
    await aiService.addBlacklist(req.user!.id, result.data.phoneNumber.replace(/[^0-9]/g, ''))
    return reply.status(201).send({ ok: true })
  })

  app.delete('/blacklist/:phone', { preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const phone = (req.params as any).phone as string
    await aiService.removeBlacklist(req.user!.id, phone)
    return reply.status(204).send()
  })

  app.get('/stats', { preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const stats = await aiService.getStats(req.user!.id)
    return reply.send({ stats })
  })

  app.get('/stats/advanced', { preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const stats = await aiService.getAdvancedStats(req.user!.id)
    return reply.send({ stats })
  })

  app.get('/leads', { preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const leads = await aiService.getLeads(req.user!.id)
    return reply.send({ leads })
  })

  // Recalculare scor: tot lotul (fără body) sau un singur contact ({ phone }).
  // Rate limit strict — fiecare contact e un apel LLM (cost real).
  app.post('/leads/analyze', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const schema = z.object({ phone: z.string().min(7).max(20).optional() })
    const result = schema.safeParse(req.body ?? {})
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: String(e.path[0]), message: e.message })))

    if (result.data.phone) {
      const phone = result.data.phone.replace(/[^0-9]/g, '')
      const insight = await aiService.analyzeLead(req.user!.id, phone)
      return reply.send({ insight })
    }
    const summary = await aiService.analyzeAllLeads(req.user!.id)
    return reply.send(summary)
  })

  app.get('/conversations', { preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const conversations = await aiService.getConversations(req.user!.id)
    return reply.send({ conversations })
  })

  // Export tot istoricul de conversații al userului (rută statică — declarată ÎNAINTE de `:phone`).
  // Export = dump COMPLET de conversații (PII clienți) într-o singură cerere. Limită strictă
  // dedicată (H1) ca să oprim exfiltrarea repetată/scraping, peste gate-ul de abonament.
  app.get('/conversations/export', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } }, preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const messages = await aiService.exportConversations(req.user!.id)
    return reply.send({ messages })
  })

  app.get('/conversations/:phone', { preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const phone = (req.params as any).phone as string
    const messages = await aiService.getMessagesForContact(req.user!.id, phone)
    return reply.send({ messages })
  })

  app.delete('/conversations/:phone', { preHandler: [authenticate, requireActiveSubscription]}, async (req, reply) => {
    const phone = (req.params as any).phone as string
    await aiService.clearConversation(req.user!.id, phone)
    return reply.status(204).send()
  })

  // Emite un token de stream EFEMER (60s, scope 'sse') pentru SSE. Auth normală prin header Bearer
  // (nu prin URL). Clientul cere acest token, apoi deschide EventSource cu el (H3).
  app.post('/stream-token', { preHandler: [authenticate, requireActiveSubscription] }, async (req, reply) => {
    return reply.send({ token: createStreamToken(req.user!.id, req.user!.role) })
  })

  app.get('/stream', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const token = (req.query as any).token as string | undefined
    if (!token) return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token lipsă.' } })

    // Acceptăm DOAR token de stream dedicat (efemer), nu access token-ul (care n-ar trebui să ajungă
    // niciodată în URL/loguri). Vezi H3.
    let userId: string
    try {
      const payload = verifyStreamToken(token)
      userId = payload.userId
    } catch {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token invalid sau expirat.' } })
    }

    // Gate de abonament și pe SSE (auth-ul e inline prin query token, deci preHandler-ul nu se aplică).
    if (!(await userHasEntitlement(userId))) {
      return reply.status(402).send({ error: { code: 'SUBSCRIPTION_REQUIRED', message: 'Abonament necesar.' } })
    }

    // Cap dur pe conexiuni SSE concurente per user (L7). TREBUIE verificat ÎNAINTE de flushHeaders,
    // ca să putem încă răspunde cu un status de eroare dacă userul a atins capul.
    if (!acquireSseSlot(userId)) {
      return reply.status(429).send({ error: { code: 'TOO_MANY_STREAMS', message: 'Prea multe conexiuni active. Închide un tab și reîncearcă.' } })
    }

    reply.header('Content-Type', 'text/event-stream')
    reply.header('Cache-Control', 'no-cache')
    reply.header('Connection', 'keep-alive')
    reply.header('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    const heartbeat = setInterval(() => { reply.raw.write(': ping\n\n') }, 25000)

    const onMsg = (data: object) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }
    appEvents.on(`conv:${userId}`, onMsg)

    try {
      await new Promise<void>(resolve => req.raw.on('close', resolve))
    } finally {
      // Eliberează slotul indiferent cum se termină conexiunea (close normal sau eroare).
      clearInterval(heartbeat)
      appEvents.off(`conv:${userId}`, onMsg)
      releaseSseSlot(userId)
    }
  })
}
