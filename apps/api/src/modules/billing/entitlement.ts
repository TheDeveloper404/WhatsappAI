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

// Tier-ul de valoare al unui abonament (Pro/Max) — dimensiune SEPARATĂ de `isEntitled`
// (care spune doar „are/n-are drept"). Pur, fără DB, la fel ca `isEntitled`.
//   - fără abonament            → null (nu există tier de evaluat)
//   - coloana `tier` = 'max'    → 'max'
//   - altfel ('pro', NULL, orice valoare neașteptată) → 'pro' (grandfathering pt legacy 49/399;
//     fail-closed pentru funcțiile Max-only: orice nu e explicit 'max' nu primește Max).
// NB: NU verifică entitlement-ul — apelantul gateuiește separat dreptul de acces (isEntitled);
// `subTier` răspunde doar „CE nivel are abonamentul ăsta", presupunând că dreptul e deja stabilit.
export function subTier(sub: Subscription | undefined | null): 'pro' | 'max' | null {
  if (!sub) return null
  return sub.tier === 'max' ? 'max' : 'pro'
}

// Varianta async, scoped pe user — citește abonamentul curent și aplică `subTier`.
export async function userTier(userId: string): Promise<'pro' | 'max' | null> {
  const sub = await billingRepository.findByUserId(userId)
  return subTier(sub)
}
