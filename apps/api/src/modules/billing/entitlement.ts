import type { Subscription } from '../../db/schema.js'
import { billingRepository } from './billing.repository.js'

// Sursa unică de adevăr pentru „are dreptul să folosească produsul premium".
// Derivată din STAREA REALĂ a abonamentului (tabela `subscriptions`, actualizată de webhook-ul
// Stripe), NU dintr-un flag cache-uit (`ai_settings.adminDisabled`). Vezi SECURITY_AUDIT C1/C2/M2.
//
// Reguli (fail-closed — orice ambiguitate = fără drept):
//  - `active`    → drept valid, CU un backstop: dacă abonamentul e marcat pentru anulare la
//                  finalul perioadei (`cancelAtPeriodEnd`) ȘI perioada s-a încheiat, dar
//                  evenimentul de anulare n-a sosit încă, refuzăm (apărare contra evenimentelor
//                  Stripe ratate/întârziate — M7).
//  - `trialing`  → drept valid DOAR cât timp trial-ul nu a expirat (apărare contra unui webhook
//                  `trialing→active/past_due` ratat).
//  - orice altceva (`incomplete`, `past_due`, `canceled`, fără abonament) → fără drept.
export function isEntitled(sub: Subscription | undefined | null, now: number = Date.now()): boolean {
  if (!sub) return false

  if (sub.status === 'active') {
    if (sub.cancelAtPeriodEnd && sub.currentPeriodEndsAt != null && now > sub.currentPeriodEndsAt) {
      return false
    }
    return true
  }

  if (sub.status === 'trialing') {
    // Trial fără dată de final: tratăm permisiv (Stripe ar trebui mereu să o seteze). Cu dată:
    // expiră strict la termen.
    return sub.trialEndsAt == null || now <= sub.trialEndsAt
  }

  return false
}

// Varianta async, scoped pe user — citește abonamentul curent și aplică `isEntitled`.
export async function userHasEntitlement(userId: string): Promise<boolean> {
  const sub = await billingRepository.findByUserId(userId)
  return isEntitled(sub)
}
