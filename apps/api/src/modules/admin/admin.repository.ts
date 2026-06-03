import { randomUUID } from 'crypto'
import { eq, desc, isNull, and, count, sql } from 'drizzle-orm'
import { db, pool } from '../../config/database.js'
import { users, subscriptions, whatsappSessions, aiSettings, notifications, platformConfig, adminAuditLog } from '../../db/schema.js'
import type { Notification } from '../../db/schema.js'

export const adminRepository = {
  async listUsers() {
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        subscriptionStatus: subscriptions.status,
        subscriptionPlan: subscriptions.plan,
        trialEndsAt: subscriptions.trialEndsAt,
        currentPeriodEndsAt: subscriptions.currentPeriodEndsAt,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        cancelAt: subscriptions.cancelAt,
        sessionStatus: whatsappSessions.status,
        sessionPhone: whatsappSessions.phoneNumber,
        sessionConnectedAt: whatsappSessions.connectedAt,
        agentActive: aiSettings.isActive,
        agentAdminDisabled: aiSettings.adminDisabled,
        agentTimerMinutes: aiSettings.timerMinutes,
        agentSystemPrompt: aiSettings.systemPrompt,
        agentKnowledgeBase: aiSettings.knowledgeBase,
        agentWritingStyle: aiSettings.writingStyle,
        agentNotifyOnAiTakeover: aiSettings.notifyOnAiTakeover,
      })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .leftJoin(whatsappSessions, eq(whatsappSessions.userId, users.id))
      .leftJoin(aiSettings, eq(aiSettings.userId, users.id))
      .orderBy(desc(users.createdAt))
  },

  async setAgentActive(userId: string, isActive: boolean): Promise<void> {
    await db.update(aiSettings)
      .set({ isActive, adminDisabled: !isActive, updatedAt: Date.now() })
      .where(eq(aiSettings.userId, userId))
  },

  async extendTrial(userId: string, days: number): Promise<void> {
    const rows = await db.select({ trialEndsAt: subscriptions.trialEndsAt })
      .from(subscriptions).where(eq(subscriptions.userId, userId))
    if (!rows[0]) return
    const base = rows[0].trialEndsAt && rows[0].trialEndsAt > Date.now()
      ? rows[0].trialEndsAt
      : Date.now()
    await db.update(subscriptions)
      .set({ trialEndsAt: base + days * 86_400_000, updatedAt: Date.now() })
      .where(eq(subscriptions.userId, userId))
  },

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId))
  },

  async getStats() {
    const [allUsers] = await db.select({ total: count() }).from(users)
    const [activeSubs] = await db.select({ total: count() }).from(subscriptions)
      .where(eq(subscriptions.status, 'active'))
    const [trialSubs] = await db.select({ total: count() }).from(subscriptions)
      .where(eq(subscriptions.status, 'trialing'))
    const [pastDueSubs] = await db.select({ total: count() }).from(subscriptions)
      .where(eq(subscriptions.status, 'past_due'))
    const [activeAgents] = await db.select({ total: count() }).from(aiSettings)
      .where(eq(aiSettings.isActive, true))
    const [connectedWhatsapp] = await db.select({ total: count() }).from(whatsappSessions)
      .where(eq(whatsappSessions.status, 'connected'))
    const [pairingWhatsapp] = await db.select({ total: count() }).from(whatsappSessions)
      .where(eq(whatsappSessions.status, 'pairing'))

    // MRR: monthly=49.99, annual=399/12≈33.25
    const activePlans = await db.select({ plan: subscriptions.plan })
      .from(subscriptions).where(eq(subscriptions.status, 'active'))
    const mrr = activePlans.reduce((sum, r) => {
      if (r.plan === 'monthly') return sum + 49.99
      if (r.plan === 'annual') return sum + 33.25
      return sum
    }, 0)

    const totalWithSub = (activeSubs.total ?? 0) + (trialSubs.total ?? 0) + (pastDueSubs.total ?? 0)
    const conversionRate = totalWithSub > 0
      ? Math.round(((activeSubs.total ?? 0) / totalWithSub) * 100)
      : 0

    // Useri noi luna aceasta
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const [newThisMonth] = await db.select({ total: count() }).from(users)
      .where(sql`created_at >= ${startOfMonth.getTime()}`)

    const now = Date.now()
    const next48h = now + 2 * 86_400_000
    const [trialsExpiringSoon] = await db.select({ total: count() }).from(subscriptions)
      .where(sql`status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at BETWEEN ${now} AND ${next48h}`)
    const [cancelingSubscriptions] = await db.select({ total: count() }).from(subscriptions)
      .where(eq(subscriptions.cancelAtPeriodEnd, true))
    const [monthlySubscribers] = await db.select({ total: count() }).from(subscriptions)
      .where(sql`status = 'active' AND plan = 'monthly'`)
    const [annualSubscribers] = await db.select({ total: count() }).from(subscriptions)
      .where(sql`status = 'active' AND plan = 'annual'`)

    const activeAgentsWithoutWhatsapp = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM ai_settings s
      LEFT JOIN whatsapp_sessions w ON w.user_id = s.user_id
      WHERE s.is_active = true
        AND COALESCE(w.status, 'disconnected') <> 'connected'
    `)

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const productMetrics = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= $1)::int AS messages_today,
        COUNT(*) FILTER (WHERE is_ai = true AND created_at >= $1)::int AS ai_messages_today,
        COUNT(*) FILTER (WHERE from_me = true AND is_ai = false AND created_at >= $1)::int AS owner_messages_today,
        COUNT(DISTINCT user_id || ':' || contact_phone)::int AS total_conversations
      FROM conversation_messages
    `, [startOfDay.getTime()])
    const metrics = productMetrics.rows[0] ?? {}
    const connectedTotal = connectedWhatsapp.total ?? 0
    const pairingTotal = pairingWhatsapp.total ?? 0
    const totalUserCount = allUsers.total ?? 0

    return {
      totalUsers: totalUserCount,
      activeSubscribers: activeSubs.total ?? 0,
      inTrial: trialSubs.total ?? 0,
      pastDue: pastDueSubs.total ?? 0,
      activeAgents: activeAgents.total ?? 0,
      mrr: Math.round(mrr * 100) / 100,
      conversionRate,
      newThisMonth: newThisMonth.total ?? 0,
      connectedWhatsapp: connectedTotal,
      pairingWhatsapp: pairingTotal,
      disconnectedWhatsapp: Math.max(totalUserCount - connectedTotal - pairingTotal, 0),
      activeAgentsWithoutWhatsapp: Number(activeAgentsWithoutWhatsapp.rows[0]?.total ?? 0),
      trialsExpiringSoon: trialsExpiringSoon.total ?? 0,
      cancelingSubscriptions: cancelingSubscriptions.total ?? 0,
      monthlySubscribers: monthlySubscribers.total ?? 0,
      annualSubscribers: annualSubscribers.total ?? 0,
      messagesToday: Number(metrics.messages_today ?? 0),
      aiMessagesToday: Number(metrics.ai_messages_today ?? 0),
      ownerMessagesToday: Number(metrics.owner_messages_today ?? 0),
      totalConversations: Number(metrics.total_conversations ?? 0),
    }
  },

  async createNotification(userId: string, type: string, title: string, body: string): Promise<void> {
    await db.insert(notifications).values({
      id: randomUUID(), userId, type, title, body, readAt: null, createdAt: Date.now(),
    })
  },

  async getAdminUserId(): Promise<string | null> {
    const { env } = await import('../../config/env.js')
    if (!env.ADMIN_EMAIL) return null
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, env.ADMIN_EMAIL))
    return rows[0]?.id ?? null
  },

  async getAdminNotifications(): Promise<Notification[]> {
    const adminId = await this.getAdminUserId()
    if (!adminId) return []
    return db.select()
      .from(notifications)
      .where(eq(notifications.userId, adminId))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
  },

  async getAdminUnreadCount(): Promise<number> {
    const adminId = await this.getAdminUserId()
    if (!adminId) return 0
    const rows = await db.select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, adminId), isNull(notifications.readAt)))
    return rows.length
  },

  async markAdminNotificationsRead(): Promise<void> {
    const adminId = await this.getAdminUserId()
    if (!adminId) return
    await db.update(notifications)
      .set({ readAt: Date.now() })
      .where(eq(notifications.userId, adminId))
  },

  async deleteAdminNotification(notificationId: string): Promise<void> {
    const adminId = await this.getAdminUserId()
    if (!adminId) return
    await db.delete(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, adminId)))
  },

  async deleteAllAdminNotifications(): Promise<void> {
    const adminId = await this.getAdminUserId()
    if (!adminId) return
    await db.delete(notifications)
      .where(eq(notifications.userId, adminId))
  },

  async getPlatformConfig(): Promise<Record<string, string>> {
    const rows = await db.select().from(platformConfig)
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  },

  async setPlatformConfig(key: string, value: string): Promise<void> {
    await db.insert(platformConfig)
      .values({ key, value, updatedAt: Date.now() })
      .onConflictDoUpdate({ target: platformConfig.key, set: { value, updatedAt: Date.now() } })
  },

  // Audit log acțiuni admin (M5).
  async logAdminAction(action: string, targetUserId: string | null, metadata: string | null, ip: string | null): Promise<void> {
    await db.insert(adminAuditLog).values({
      id: randomUUID(), action, targetUserId, metadata, ip, createdAt: Date.now(),
    })
  },

  async getAuditLog(limit = 100) {
    return db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit)
  },
}
