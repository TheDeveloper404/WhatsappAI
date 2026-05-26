import { aiRepository } from './ai.repository.js'
import { extractWritingStyle } from './groq.client.js'
import type { AiSettings } from '../../db/schema.js'

export const aiService = {
  async getSettings(userId: string): Promise<AiSettings> {
    return aiRepository.getSettings(userId)
  },

  async updateSettings(userId: string, data: { isActive?: boolean; timerMinutes?: number; systemPrompt?: string; knowledgeBase?: string; writingStyle?: string }): Promise<AiSettings> {
    await aiRepository.updateSettings(userId, data)
    return aiRepository.getSettings(userId)
  },

  async analyzeAndSaveWritingStyle(userId: string): Promise<string> {
    const messages = await aiRepository.getOwnerMessages(userId, 60)
    if (messages.length < 5) throw new Error('Nu există suficiente mesaje trimise pentru analiză (minim 5).')
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

  async clearConversation(userId: string, contactPhone: string) {
    return aiRepository.clearHistory(userId, contactPhone)
  },
}
