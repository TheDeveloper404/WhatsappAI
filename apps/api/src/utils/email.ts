import { Resend } from 'resend'
import { env } from '../config/env.js'
import { logger } from './logger.js'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const resend = new Resend(env.RESEND_API_KEY)

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:520px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0A0F0C;padding:24px 40px;">
              <span style="font-family:monospace;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                wa<span style="color:#C8FB4A;">ai.</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f7;padding:20px 40px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
                © 2026 waai. · ACL Smart Software ·
                <a href="https://waai.ro" style="color:#9CA3AF;text-decoration:none;">waai.ro</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(href: string, label: string, color = '#C8FB4A', textColor = '#0A0F0C'): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:${color};border-radius:50px;padding:14px 32px;">
          <a href="${href}" style="font-family:monospace;font-size:14px;font-weight:700;color:${textColor};text-decoration:none;display:block;white-space:nowrap;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${env.APP_URL}/verify-email?token=${token}`
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Verifică-ți adresa de email — waai.',
    html: baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0A0F0C;">Bun venit, ${escapeHtml(name)}! 👋</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#6B7280;line-height:1.6;">
        Ești aproape gata. Verifică-ți adresa de email pentru a activa contul.
      </p>
      ${ctaButton(link, 'Verifică emailul →')}
      <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
        Link-ul expiră în <strong>24 de ore</strong>. Dacă nu ai creat un cont pe waai.ro, ignoră acest email.
      </p>
    `),
  })
  if (error) throw new Error(`Resend error (verification): ${error.message}`)
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${env.APP_URL}/reset-password?token=${token}`
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Resetare parolă — waai.',
    html: baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0A0F0C;">Resetare parolă</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#6B7280;line-height:1.6;">
        Ai solicitat resetarea parolei pentru contul tău waai. Apasă butonul de mai jos:
      </p>
      ${ctaButton(link, 'Resetează parola →')}
      <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
        Link-ul expiră în <strong>1 oră</strong>. Dacă nu ai solicitat resetarea, ignoră acest email.
      </p>
    `),
  })
  if (error) throw new Error(`Resend error (reset): ${error.message}`)
}

// Confirmare comandă trimisă clientului la cerere (Faza 5). Datele (linii, total) sunt
// PRE-FORMATATE de handler din prețurile din DB — email.ts doar randează, nu atinge banii.
export type OrderEmailSummary = {
  lines: string[]        // ex: "2× Margherita — 50.00 lei"
  total: string          // ex: "50.00 lei"
  details?: string       // specificații colectate (opțional)
}

export async function sendOrderConfirmationEmail(to: string, businessName: string, orders: OrderEmailSummary[]) {
  const blocks = orders.map((o, i) => {
    const itemsHtml = o.lines.map(l => `<li style="margin:0 0 4px;font-size:14px;color:#374151;">${escapeHtml(l)}</li>`).join('')
    const detailsHtml = o.details?.trim()
      ? `<p style="margin:8px 0 0;font-size:13px;color:#6B7280;white-space:pre-wrap;">${escapeHtml(o.details.trim())}</p>`
      : ''
    return `
      <div style="border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin:0 0 12px;">
        ${orders.length > 1 ? `<p style="margin:0 0 8px;font-size:12px;color:#9CA3AF;">Comanda ${i + 1}</p>` : ''}
        <ul style="margin:0;padding-left:18px;">${itemsHtml}</ul>
        ${detailsHtml}
        <p style="margin:12px 0 0;font-size:15px;font-weight:700;color:#0A0F0C;">Total: ${escapeHtml(o.total)}</p>
      </div>`
  }).join('')

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: `Confirmare comandă — ${escapeHtml(businessName)}`,
    html: baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0A0F0C;">Confirmare comandă</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#6B7280;line-height:1.6;">
        Îți mulțumim! Mai jos găsești rezumatul comenzii tale. Te contactăm în scurt timp pentru detalii.
      </p>
      ${blocks}
      <p style="margin:16px 0 0;font-size:13px;color:#9CA3AF;line-height:1.6;">
        Dacă ai întrebări, răspunde direct pe WhatsApp.
      </p>
    `),
  })
  if (error) throw new Error(`Resend error (order confirmation): ${error.message}`)
}

export async function sendCustomEmail(to: string, subject: string, body: string) {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html: baseTemplate(`
      <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;white-space:pre-wrap;">${escapeHtml(body)}</p>
    `),
  })
  if (error) throw new Error(`Resend error (custom): ${error.message}`)
}

export async function sendAdminNotificationEmail(to: string, title: string, body: string) {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: `[waai. Admin] ${escapeHtml(title)}`,
    html: baseTemplate(`
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0A0F0C;">${escapeHtml(title)}</h1>
      <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;white-space:pre-wrap;">${escapeHtml(body)}</p>
    `),
  })
  if (error) logger.error('[email] admin notification failed', { err: error.message })
}

export async function sendAccountDeletionEmail(to: string, name: string) {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Contul tău va fi șters în 48 de ore — waai.',
    html: baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#DC2626;">Cerere de ștergere cont</h1>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">Salut ${escapeHtml(name)},</p>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        Am primit cererea ta de ștergere a contului. Contul și toate datele asociate vor fi șterse definitiv în <strong>48 de ore</strong>.
      </p>
      <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
        Dacă nu ai solicitat această acțiune sau ai schimbat decizia, contactează-ne la
        <a href="mailto:support@waai.ro" style="color:#0A0F0C;">support@waai.ro</a> înainte de expirarea termenului.
      </p>
    `),
  })
  if (error) logger.error('[email] account deletion email failed', { err: error.message })
}
