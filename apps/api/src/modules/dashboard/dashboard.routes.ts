import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireDashboardAuth } from './basic-auth.js'
import { DASHBOARD_HTML, DASHBOARD_JS } from './dashboard.page.js'
import { aiRepository } from '../ai/ai.repository.js'
import { getWhatsappState, startPairing, disconnectSession } from '../whatsapp/whatsapp.session-manager.js'
import { OWNER_ID } from '../../config/owner.js'
import { env } from '../../config/env.js'
import { Errors } from '../../utils/errors.js'

const settingsSchema = z.object({
  isActive: z.boolean().optional(),
  timerMinutes: z.number().int().min(1).max(60).optional(),
}).strict()

const phoneParam = z.object({ phone: z.string().regex(/^\d{3,20}$/) })

export async function dashboardRoutes(app: FastifyInstance) {
  // Toate rutele din acest plugin cer parola dashboard-ului. `preHandler` (nu `onRequest`) ca
  // rate-limit-ul (hook onRequest) să numere și încercările cu parolă greșită → anti brute-force.
  app.addHook('preHandler', requireDashboardAuth)
  const rl = { rateLimit: { max: 120, timeWindow: '1 minute' } }

  app.get('/', { config: rl }, async (_req, reply) => reply.type('text/html; charset=utf-8').send(DASHBOARD_HTML))
  app.get('/app.js', { config: rl }, async (_req, reply) => reply.type('application/javascript; charset=utf-8').send(DASHBOARD_JS))

  app.get('/api/status', { config: rl }, async () => {
    const [whatsapp, settings, replies24h] = await Promise.all([
      getWhatsappState(),
      aiRepository.getSettings(OWNER_ID),
      aiRepository.countAiRepliesSince(OWNER_ID, Date.now() - 86_400_000),
    ])
    return {
      whatsapp,
      ai: {
        isActive: settings.isActive,
        timerMinutes: settings.timerMinutes,
        pauseUntil: settings.pauseUntil && settings.pauseUntil > Date.now() ? settings.pauseUntil : null,
        model: env.LLM_MODEL,
        replies24h,
      },
    }
  })

  app.post('/api/whatsapp/connect', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async () => {
    await startPairing()
    return { ok: true }
  })

  app.post('/api/whatsapp/disconnect', { config: rl }, async () => {
    await disconnectSession()
    return { ok: true }
  })

  app.patch('/api/settings', { config: rl }, async (req) => {
    const parsed = settingsSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })))
    }
    const patch = parsed.data.isActive !== undefined
      ? { ...parsed.data, pauseUntil: null }
      : parsed.data
    await aiRepository.updateSettings(OWNER_ID, patch)
    return { ok: true }
  })

  app.get('/api/conversations', { config: rl }, async () => {
    return { conversations: await aiRepository.getConversations(OWNER_ID, 50) }
  })

  app.get('/api/conversations/:phone/messages', { config: rl }, async (req) => {
    const parsed = phoneParam.safeParse(req.params)
    if (!parsed.success) throw Errors.validation([{ field: 'phone', message: 'Număr invalid' }])
    const rows = await aiRepository.getMessagesForContact(OWNER_ID, parsed.data.phone)
    return {
      messages: rows.map(r => ({ fromMe: r.fromMe, isAi: r.isAi, body: r.body, at: r.waTimestamp })),
    }
  })
}
