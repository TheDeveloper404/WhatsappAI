import { Resend } from 'resend'
import { env } from '../config/env.js'
import { logger } from './logger.js'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const resend = new Resend(env.RESEND_API_KEY)

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${env.APP_URL}/verify-email?token=${token}`
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Verifică-ți adresa de email — WhatsApp AI',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#16A34A">Bun venit, ${escapeHtml(name)}!</h2>
        <p>Apasă butonul de mai jos pentru a-ți verifica adresa de email:</p>
        <a href="${link}" style="display:inline-block;background:#16A34A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Verifică emailul
        </a>
        <p style="color:#6B7280;font-size:14px">Link-ul expiră în 24 de ore. Dacă nu ai creat un cont, ignoră acest email.</p>
      </div>
    `,
  })
  if (error) throw new Error(`Resend error (verification): ${error.message}`)
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${env.APP_URL}/reset-password?token=${token}`
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Resetare parolă — WhatsApp AI',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#16A34A">Resetare parolă</h2>
        <p>Ai solicitat resetarea parolei. Apasă butonul de mai jos:</p>
        <a href="${link}" style="display:inline-block;background:#16A34A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Resetează parola
        </a>
        <p style="color:#6B7280;font-size:14px">Link-ul expiră în 1 oră. Dacă nu ai solicitat resetarea, ignoră acest email.</p>
      </div>
    `,
  })
  if (error) throw new Error(`Resend error (reset): ${error.message}`)
}

export async function sendCustomEmail(to: string, subject: string, body: string) {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <p style="white-space:pre-wrap;color:#374151;line-height:1.6">${escapeHtml(body)}</p>
        <p style="color:#9CA3AF;font-size:12px;margin-top:32px;border-top:1px solid #E5E7EB;padding-top:16px">WhatsApp AI Platform</p>
      </div>
    `,
  })
  if (error) throw new Error(`Resend error (custom): ${error.message}`)
}

export async function sendAdminNotificationEmail(to: string, title: string, body: string) {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: `[WhatsApp AI Admin] ${title}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#16A34A">${escapeHtml(title)}</h2>
        <p style="white-space:pre-wrap;color:#374151">${escapeHtml(body)}</p>
        <p style="color:#9CA3AF;font-size:12px;margin-top:32px">WhatsApp AI Platform — notificare automată</p>
      </div>
    `,
  })
  if (error) logger.error('[email] admin notification failed', { err: error.message })
}

export async function sendAccountDeletionEmail(to: string, name: string) {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Contul tău va fi șters în 48 de ore — WhatsApp AI',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#DC2626">Cerere de ștergere cont</h2>
        <p>Salut ${escapeHtml(name)},</p>
        <p>Am primit cererea ta de ștergere a contului. Contul și toate datele asociate vor fi șterse definitiv în <strong>48 de ore</strong>.</p>
        <p style="color:#6B7280;font-size:14px">Dacă nu ai solicitat această acțiune sau ai schimbat decizia, contactează-ne la <a href="mailto:hi@waai.ro">hi@waai.ro</a> înainte de expirarea termenului.</p>
        <p style="color:#9CA3AF;font-size:12px;margin-top:32px;border-top:1px solid #E5E7EB;padding-top:16px">WhatsApp AI Platform</p>
      </div>
    `,
  })
  if (error) logger.error('[email] account deletion email failed', { err: error.message })
}
