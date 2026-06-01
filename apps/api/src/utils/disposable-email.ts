// Domenii de email „de unică folosință" (throwaway). Le blocăm la înregistrare ca să oprim conturile
// spam generate automat — botul din 01.06.2026 folosea exact astfel de domenii (mailinator,
// guerrillamailblock, wshu.net). Lista nu e exhaustivă; acoperă furnizorii populari și o putem extinde.
const DISPOSABLE_DOMAINS = new Set<string>([
  // observate în spam-ul real
  'mailinator.com', 'guerrillamail.com', 'guerrillamailblock.com', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamail.biz', 'guerrillamail.de', 'sharklasers.com', 'grr.la',
  'wshu.net',
  // alți furnizori populari de email temporar
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'temp-mail.io',
  'tempmailo.com', 'throwawaymail.com', 'yopmail.com', 'yopmail.fr', 'getnada.com',
  'maildrop.cc', 'dispostable.com', 'fakeinbox.com', 'trashmail.com', 'mailnesia.com',
  'mohmal.com', 'emailondeck.com', 'mintemail.com', 'spamgourmet.com', 'mailcatch.com',
  'tmpmail.org', 'mailsac.com', 'inboxkitten.com', 'tempr.email', 'discard.email',
  'spam4.me', 'burnermail.io', 'mailpoof.com', 'moakt.com', 'fakemail.net', 'trbvm.com',
])

// Întoarce true dacă emailul folosește un domeniu de unică folosință. Conservator: compară DOAR
// domeniul exact (case-insensitive), fără euristici care ar putea bloca emailuri legitime.
export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at === -1) return false
  const domain = email.slice(at + 1).trim().toLowerCase()
  return DISPOSABLE_DOMAINS.has(domain)
}
