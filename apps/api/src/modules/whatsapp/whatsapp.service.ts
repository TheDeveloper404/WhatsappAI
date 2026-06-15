import { randomUUID } from 'crypto'
import { whatsappRepository } from './whatsapp.repository.js'
import { requestQrCode, disconnectSession } from './whatsapp.session-manager.js'
import { Errors } from '../../utils/errors.js'
import type { WhatsappSession } from '../../db/schema.js'

export const whatsappService = {
  async getSession(userId: string): Promise<WhatsappSession | null> {
    const session = await whatsappRepository.findByUserId(userId)
    if (!session) return null
    // Pairing „lipicios": codul QR expiră în 60s, dar nimic nu reseta starea → cardul rămânea
    // blocat pe „Asociere…" la nesfârșit, inclusiv după o reconectare de fundal cu credențiale
    // moarte care re-aprinde un QR fără acțiunea owner-ului. Normalizăm la CITIRE: un pairing cu
    // codul expirat = practic deconectat (read pur, fără write pe GET). Acoperă ambele căi (QR
    // nescanat + reconectare automată) și toate intrările (load inițial + poll).
    if (session.status === 'pairing' && session.pairingCodeExpiresAt && session.pairingCodeExpiresAt < Date.now()) {
      return { ...session, status: 'disconnected', pairingCode: null }
    }
    return session
  },

  async connect(userId: string): Promise<{ qrCode: string }> {
    const now = Date.now()
    await whatsappRepository.upsert({
      id: randomUUID(),
      userId,
      phoneNumber: null,
      status: 'pairing',
      pairingCode: null,
      pairingCodeExpiresAt: null,
      connectedAt: null,
      createdAt: now,
      updatedAt: now,
    })

    let qrCode: string
    try {
      qrCode = await requestQrCode(userId)
    } catch (err: any) {
      await whatsappRepository.update(userId, {
        status: 'disconnected',
        pairingCode: null,
        pairingCodeExpiresAt: null,
      })
      throw Errors.internal(err?.message ?? 'Eroare la conectare WhatsApp.')
    }

    await whatsappRepository.update(userId, {
      status: 'pairing',
      pairingCode: qrCode,
      pairingCodeExpiresAt: Date.now() + 60_000,
    })

    return { qrCode }
  },

  async disconnect(userId: string): Promise<void> {
    const session = await whatsappRepository.findByUserId(userId)
    if (!session) throw Errors.notFound('Sesiune WhatsApp')
    await disconnectSession(userId)
  },
}
