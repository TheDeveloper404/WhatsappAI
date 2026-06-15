import { aiRepository } from './ai.repository.js'
import { extractWritingStyle, classifyLead } from './groq.client.js'
import { logger } from '../../utils/logger.js'
import { Errors } from '../../utils/errors.js'
import type { AiSettings } from '../../db/schema.js'

// Plafon pentru recalcularea în masă a lead-urilor — limitează costul LLM și durata
// request-ului (apeluri Groq secvențiale) la un click „Recalculează". Ținut mic ca să
// nu riscăm timeout de gateway pe Railway; restul se recalculează per-contact.
const LEAD_ANALYZE_BATCH_MAX = 15

export const aiService = {
  async getSettings(userId: string): Promise<AiSettings> {
    return aiRepository.getSettings(userId)
  },

  async updateSettings(userId: string, data: { isActive?: boolean; timerMinutes?: number; systemPrompt?: string; knowledgeBase?: string; writingStyle?: string; notifyOnAiTakeover?: boolean; leadCriteria?: string; currency?: string; orderIntakePrompt?: string; workingHours?: string }): Promise<AiSettings> {
    await aiRepository.updateSettings(userId, data)
    return aiRepository.getSettings(userId)
  },

  async analyzeAndSaveWritingStyle(userId: string): Promise<string> {
    const messages = await aiRepository.getOwnerMessages(userId, 60)
    if (messages.length < 5) throw Errors.unprocessable('Nu există suficiente mesaje trimise pentru analiză (minim 5).')
    const style = await extractWritingStyle(messages)
    await aiRepository.updateSettings(userId, { writingStyle: style })
    return style
  },

  async getBlacklist(userId: string): Promise<string[]> {
    return aiRepository.getBlacklist(userId)
  },

  async addBlacklist(userId: string, phoneNumber: string): Promise<void> {
    await aiRepository.addBlacklist(userId, phoneNumber)
  },

  async removeBlacklist(userId: string, phoneNumber: string): Promise<void> {
    await aiRepository.removeBlacklist(userId, phoneNumber)
  },

  async getConversations(userId: string) {
    return aiRepository.getConversations(userId)
  },

  async getMessagesForContact(userId: string, contactPhone: string) {
    return aiRepository.getMessagesForContact(userId, contactPhone)
  },

  async exportConversations(userId: string) {
    return aiRepository.getAllMessagesForExport(userId)
  },

  async clearConversation(userId: string, contactPhone: string) {
    return aiRepository.clearHistory(userId, contactPhone)
  },

  async getStats(userId: string) {
    return aiRepository.getStats(userId)
  },

  async getAdvancedStats(userId: string) {
    return aiRepository.getAdvancedStats(userId)
  },

  async getLeads(userId: string) {
    return aiRepository.getLeads(userId)
  },

  // Recalculează scorul unui singur contact (la cerere din dashboard).
  async analyzeLead(userId: string, contactPhone: string) {
    const [settings, messages] = await Promise.all([
      aiRepository.getSettings(userId),
      aiRepository.getMessagesForContact(userId, contactPhone),
    ])
    if (messages.length === 0) throw Errors.unprocessable('Nu există conversație pentru acest contact.')
    const result = await classifyLead(settings.leadCriteria, messages.map(m => ({ fromMe: m.fromMe, body: m.body })))
    await aiRepository.upsertLeadInsight(userId, contactPhone, result)
    return result
  },

  // Recalculează scorurile pentru cele mai recente contacte (plafonat). Fail-soft per contact.
  async analyzeAllLeads(userId: string): Promise<{ analyzed: number; failed: number }> {
    const settings = await aiRepository.getSettings(userId)
    const phones = await aiRepository.getRecentContactPhones(userId, LEAD_ANALYZE_BATCH_MAX)
    let analyzed = 0
    let failed = 0
    for (const phone of phones) {
      try {
        const messages = await aiRepository.getMessagesForContact(userId, phone)
        if (messages.length === 0) continue
        const result = await classifyLead(settings.leadCriteria, messages.map(m => ({ fromMe: m.fromMe, body: m.body })))
        await aiRepository.upsertLeadInsight(userId, phone, result)
        analyzed++
      } catch (err) {
        // Nu mai înghițim tăcut: numărăm eșecurile ca să le raportăm în UI (ex. limită AI atinsă).
        failed++
        logger.error(`[AI][${userId.slice(0, 8)}] eroare calificare lead`, { err: String(err) })
      }
    }
    return { analyzed, failed }
  },
}
