import { createRequire } from 'node:module'

// Lista mare e livrată ca JSON de pachetul `disposable-email-domains` (~120k domenii + ~400 wildcard,
// întreținut, updatabil cu `pnpm update`). O încărcăm cu createRequire fiindcă main-ul pachetului e un
// fișier .json (importul ESM direct de JSON din pachet ar cere assertion și e fragil între versiuni Node).
const require = createRequire(import.meta.url)
const packaged: string[] = require('disposable-email-domains')
const wildcardList: string[] = require('disposable-email-domains/wildcard.json')

// Domenii observate în spam-ul real (01.06.2026) care NU sunt în pachet — ex. wshu.net. Le păstrăm
// explicit ca să nu regresăm acoperirea dacă pachetul nu le are.
const OBSERVED = [
  'wshu.net', 'guerrillamailblock.com',
]

const DISPOSABLE_DOMAINS = new Set<string>([...packaged, ...OBSERVED].map(d => d.toLowerCase()))
// Wildcard: domeniul SAU orice subdomeniu al lui e de unică folosință (ex. `0x01.gq` → și `a.0x01.gq`).
const WILDCARD_DOMAINS = new Set<string>(wildcardList.map(d => d.toLowerCase()))

// Întoarce true dacă emailul folosește un domeniu de unică folosință. Verifică match exact pe lista
// mare ȘI sufixele domeniului contra listei wildcard. Conservator: doar pe domeniu, fără euristici care
// ar putea bloca emailuri legitime.
export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at === -1) return false
  const domain = email.slice(at + 1).trim().toLowerCase()
  if (!domain) return false
  if (DISPOSABLE_DOMAINS.has(domain)) return true

  // Walk pe sufixe: pt `a.b.0x01.gq` verificăm `a.b.0x01.gq`, `b.0x01.gq`, `0x01.gq` în lista wildcard.
  const parts = domain.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    if (WILDCARD_DOMAINS.has(parts.slice(i).join('.'))) return true
  }
  return false
}
