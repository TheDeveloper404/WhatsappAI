const isProd = process.env.NODE_ENV === 'production'

type LogCtx = Record<string, unknown>

function write(level: string, msg: string, ctx?: LogCtx) {
  if (isProd) {
    process.stdout.write(JSON.stringify({ level, msg, ...ctx, time: Date.now() }) + '\n')
  } else {
    const extra = ctx && Object.keys(ctx).length ? ctx : undefined
    if (level === 'error') console.error(`[${level.toUpperCase()}] ${msg}`, extra ?? '')
    else console.log(`[${level.toUpperCase()}] ${msg}`, extra ?? '')
  }
}

export const logger = {
  info:  (msg: string, ctx?: LogCtx) => write('info',  msg, ctx),
  warn:  (msg: string, ctx?: LogCtx) => write('warn',  msg, ctx),
  error: (msg: string, ctx?: LogCtx) => write('error', msg, ctx),
}

// F-PII-01: pseudonimizare telefon/JID în loguri (PII). Păstrează doar ultimele 4 cifre pentru
// corelație, restul mascat — consecvent cu `userId.slice(0,8)`. Acceptă fie un număr, fie un JID
// WhatsApp (`40712...@s.whatsapp.net`). `null`/gol → '∅'.
export function maskPhone(value: string | null | undefined): string {
  if (!value) return '∅'
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 4) return `***${digits}`
  return `***${digits.slice(-4)}`
}
