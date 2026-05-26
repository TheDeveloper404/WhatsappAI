import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { aiService } from './ai.service.js'
import { Errors } from '../../utils/errors.js'

export async function aiRoutes(app: FastifyInstance) {
  app.get('/settings', { preHandler: authenticate }, async (req, reply) => {
    const settings = await aiService.getSettings(req.user!.id)
    return reply.send({ settings })
  })

  app.patch('/settings', { preHandler: authenticate }, async (req, reply) => {
    const schema = z.object({
      isActive: z.boolean().optional(),
      timerMinutes: z.number().int().min(1).max(60).optional(),
      systemPrompt: z.string().min(10).max(2000).optional(),
      knowledgeBase: z.string().max(5000).optional(),
      writingStyle: z.string().max(2000).optional(),
    })
    const result = schema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: String(e.path[0]), message: e.message })))
    const settings = await aiService.updateSettings(req.user!.id, result.data)
    return reply.send({ settings })
  })

  app.post('/analyze-style', { config: { rateLimit: { max: 3, timeWindow: '1 minute' } }, preHandler: authenticate }, async (req, reply) => {
    const writingStyle = await aiService.analyzeAndSaveWritingStyle(req.user!.id)
    return reply.send({ writingStyle })
  })

  app.get('/blacklist', { preHandler: authenticate }, async (req, reply) => {
    const phones = await aiService.getBlacklist(req.user!.id)
    return reply.send({ phones })
  })

  app.post('/blacklist', { preHandler: authenticate }, async (req, reply) => {
    const schema = z.object({ phoneNumber: z.string().min(7).max(20) })
    const result = schema.safeParse(req.body)
    if (!result.success) throw Errors.validation(result.error.errors.map(e => ({ field: String(e.path[0]), message: e.message })))
    await aiService.addBlacklist(req.user!.id, result.data.phoneNumber.replace(/[^0-9]/g, ''))
    return reply.status(201).send({ ok: true })
  })

  app.delete('/blacklist/:phone', { preHandler: authenticate }, async (req, reply) => {
    const phone = (req.params as any).phone as string
    await aiService.removeBlacklist(req.user!.id, phone)
    return reply.status(204).send()
  })

  app.get('/conversations', { preHandler: authenticate }, async (req, reply) => {
    const conversations = await aiService.getConversations(req.user!.id)
    return reply.send({ conversations })
  })

  app.get('/conversations/:phone', { preHandler: authenticate }, async (req, reply) => {
    const phone = (req.params as any).phone as string
    const messages = await aiService.getMessagesForContact(req.user!.id, phone)
    return reply.send({ messages })
  })

  app.delete('/conversations/:phone', { preHandler: authenticate }, async (req, reply) => {
    const phone = (req.params as any).phone as string
    await aiService.clearConversation(req.user!.id, phone)
    return reply.status(204).send()
  })
}
