import { Resend } from 'resend'
import { env } from '../config/env.js'
import { logger } from './logger.js'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const resend = new Resend(env.RESEND_API_KEY)

// `preheader` = textul de previzualizare afișat de client în inbox lângă subiect (ascuns în corp).
function baseTemplate(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="ro" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>waai.</title>
</head>
<body style="margin:0;padding:0;background:#eceae3;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <!-- Preheader (preview text, ascuns) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#eceae3;opacity:0;">
    ${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceae3;background-image:radial-gradient(circle at 50% 0,#f4f4f0,#e4e2da);padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;max-width:560px;width:100%;box-shadow:0 12px 40px rgba(10,15,12,0.10);border:1px solid rgba(10,15,12,0.06);">

          <!-- Accent strip -->
          <tr>
            <td style="height:5px;line-height:5px;font-size:0;background:#C8FB4A;background-image:linear-gradient(90deg,#C8FB4A 0%,#9ee83d 45%,#C8FB4A 100%);">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background:#0A0F0C;background-image:linear-gradient(135deg,#0A0F0C 0%,#16201A 100%);padding:30px 40px 26px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                      wa<span style="color:#C8FB4A;">ai.</span>
                    </span>
                    <div style="margin-top:6px;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:11px;color:#7E8B82;letter-spacing:1.5px;text-transform:uppercase;">
                      asistentul tău pe WhatsApp
                    </div>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;width:36px;height:36px;line-height:36px;text-align:center;border-radius:10px;background:rgba(200,251,74,0.12);border:1px solid rgba(200,251,74,0.30);font-size:18px;">🤖</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:42px 40px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f7f7f4;padding:26px 40px;border-top:1px solid #E5E7EB;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:14px;font-weight:700;color:#0A0F0C;">wa<span style="color:#7FB300;">ai.</span></span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <a href="https://waai.ro" style="font-size:12px;color:#6B7280;text-decoration:none;padding:0 8px;">Site</a>
                    <span style="color:#D1D5DB;">·</span>
                    <a href="https://waai.ro/login" style="font-size:12px;color:#6B7280;text-decoration:none;padding:0 8px;">Contul meu</a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:11px;color:#9CA3AF;line-height:1.6;">
                © 2026 waai. · ACL Smart Software. Acest mesaj a fost trimis automat — te rugăm să nu răspunzi direct la el.
              </p>
            </td>
          </tr>

        </table>

        <!-- Sub-card note -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding:18px 24px 0;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.6;">
                Primești acest email pentru că există un cont waai. asociat acestei adrese.
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
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
      <tr>
        <td style="background:${color};border-radius:50px;box-shadow:0 6px 18px rgba(200,251,74,0.35);">
          <a href="${href}" style="font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:14px;font-weight:700;color:${textColor};text-decoration:none;display:inline-block;padding:15px 36px;white-space:nowrap;letter-spacing:0.2px;">
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
      <p style="margin:0 0 10px;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:11px;font-weight:700;color:#7FB300;letter-spacing:1.5px;text-transform:uppercase;">Pasul 1 din 2 · Activare cont</p>
      <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#0A0F0C;line-height:1.25;">Bun venit, ${escapeHtml(name)}! 👋</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#6B7280;line-height:1.7;">
        Mai e un singur pas: confirmă-ți adresa de email și contul tău waai. devine activ.
        După verificare poți conecta WhatsApp și lăsa asistentul să răspundă în locul tău.
      </p>
      ${ctaButton(link, 'Verifică emailul →')}
      <p style="margin:0 0 18px;font-size:13px;color:#9CA3AF;line-height:1.6;">
        Link-ul expiră în <strong>24 de ore</strong>. Dacă nu ai creat un cont pe waai.ro, ignoră acest email.
      </p>
      <p style="margin:0;padding-top:18px;border-top:1px solid #F0F0EC;font-size:12px;color:#9CA3AF;line-height:1.6;word-break:break-all;">
        Butonul nu merge? Copiază link-ul în browser:<br />
        <a href="${link}" style="color:#7FB300;text-decoration:none;">${link}</a>
      </p>
    `, `Confirmă-ți adresa și activează contul waai. Link valabil 24 de ore.`),
  })
  if (error) throw new Error(`Resend error (verification): ${error.message}`)
}

// Trimis când cineva încearcă să se înregistreze cu un email care ARE deja cont (M8). Înlocuiește
// răspunsul 409 (care trăda existența contului) — răspunsul HTTP devine identic cu o înregistrare nouă,
// iar proprietarul real e informat aici (login / resetare parolă).
export async function sendAlreadyRegisteredEmail(to: string, name: string) {
  const loginLink = `${env.APP_URL}/login`
  const resetLink = `${env.APP_URL}/forgot-password`
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Ai deja un cont — waai.',
    html: baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0A0F0C;">Salut, ${escapeHtml(name)}!</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#6B7280;line-height:1.6;">
        Cineva (poate tu) a încercat să creeze un cont cu această adresă, dar ai deja unul. Nu am creat un cont nou.
      </p>
      ${ctaButton(loginLink, 'Intră în cont →')}
      <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
        Ți-ai uitat parola? <a href="${resetLink}" style="color:#7FB300;">Resetează parola</a>.
        Dacă nu ai încercat tu, poți ignora acest email.
      </p>
    `, `Ai deja un cont waai. Intră în cont sau resetează-ți parola.`),
  })
  if (error) throw new Error(`Resend error (already registered): ${error.message}`)
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
    `, `Resetează-ți parola waai. Link valabil 1 oră.`),
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
    `, `Rezumatul comenzii tale de la ${businessName}.`),
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

export async function sendAccountDeletionEmail(to: string, name: string, token: string) {
  const link = `${env.APP_URL}/sterge-cont?token=${token}`
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Confirmă ștergerea contului — waai.',
    html: baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#DC2626;">Confirmă ștergerea contului</h1>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">Salut ${escapeHtml(name)},</p>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        Am primit o cerere de ștergere a contului tău waai. Pentru a o confirma, apasă butonul de mai jos.
        <strong>Contul și toate datele asociate vor fi șterse definitiv și ireversibil.</strong>
      </p>
      ${ctaButton(link, 'Confirmă ștergerea →')}
      <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.6;">
        Link-ul expiră în <strong>1 oră</strong>. Dacă nu ai solicitat ștergerea, ignoră acest email —
        contul tău rămâne neatins.
      </p>
    `, `Confirmă ștergerea definitivă a contului waai. Link valabil 1 oră.`),
  })
  if (error) logger.error('[email] account deletion email failed', { err: error.message })
}
