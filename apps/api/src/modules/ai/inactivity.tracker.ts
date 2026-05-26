// Tracks the last time the owner manually replied to each contact.
// Stored in-memory — resets on API restart (acceptable: owners are online at restart).

const lastOwnerReply = new Map<string, Map<string, number>>()

export function recordOwnerReply(userId: string, contactPhone: string): void {
  if (!lastOwnerReply.has(userId)) lastOwnerReply.set(userId, new Map())
  lastOwnerReply.get(userId)!.set(contactPhone, Date.now())
}

export function isOwnerActive(userId: string, contactPhone: string, timerMinutes: number): boolean {
  const ts = lastOwnerReply.get(userId)?.get(contactPhone)
  if (!ts) return false
  return Date.now() - ts < timerMinutes * 60 * 1000
}
