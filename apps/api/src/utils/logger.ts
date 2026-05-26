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
