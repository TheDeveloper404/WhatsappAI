// Cap dur pe conexiuni SSE concurente per user (L7). `/ai/stream` ține conexiuni persistente;
// rate-limit-ul de 30/min/IP limitează doar RATA de deschidere, nu numărul de conexiuni deschise
// simultan. Fără un cap, un singur user (sau token-uri de stream scurse / un client buggy care
// reconectează fără să închidă) poate acumula conexiuni → file descriptors, listeneri pe appEvents
// (risc de warning „possible memory leak" peste maxListeners) și memorie.
//
// In-memory, instanță unică pe Railway (ca `incoming.rate-limiter` / `pendingResponses`): un restart
// resetează contoarele, acceptabil pentru atenuare de abuz. Dacă scalezi multi-instanță, contorul ar
// trebui mutat într-un store partajat (sau capul aplicat la nivel de proxy).

const active = new Map<string, number>() // userId → nr. conexiuni SSE deschise acum

// Generos pentru trafic legitim (mai multe tab-uri/dispozitive), dar taie acumularea abuzivă.
export const MAX_SSE_PER_USER = 8

// Încearcă să rezerve un slot. true = poți deschide stream-ul; false = ai atins capul → apelantul
// respinge cu 429 ÎNAINTE de a trimite headerele SSE.
export function acquireSseSlot(userId: string): boolean {
  const n = active.get(userId) ?? 0
  if (n >= MAX_SSE_PER_USER) return false
  active.set(userId, n + 1)
  return true
}

// Eliberează slotul la închiderea conexiunii. Idempotent la nivel de contor (nu scade sub 0).
export function releaseSseSlot(userId: string): void {
  const n = active.get(userId) ?? 0
  if (n <= 1) active.delete(userId)
  else active.set(userId, n - 1)
}
