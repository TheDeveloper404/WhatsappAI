import type { Subscription } from '../../db/schema.js'
import { billingRepository } from './billing.repository.js'
import { authRepository } from '../auth/auth.repository.js'
import { env } from '../../config/env.js'

// Owner bypass (consecvent cu `requireActiveSubscription`, care îl aplică pe rutele API prin email).
// AICI îl aplicăm pe calea scoped-pe-userId — singura folosită de fluxul WhatsApp/AI, care NU trece
// prin middleware. Fără asta, owner-ul s-ar putea loga în dashboard dar agentul lui ar fi mort
// (hard wall din `executeCommand` + blocaj generare). Owner = drept valid + tier 'max' (toate funcțiile).
//
// `OWNER_EMAIL` → `userId` se rezolvă o singură dată și se memoizează, ca să NU adăugăm un query pe
// fiecare mesaj WhatsApp. `undefined` = nerezolvat încă; `null` = email setat dar contul încă neexistent
// (owner nu s-a înregistrat) — reîncercăm cel mult o dată la 60s ca să nu lovim DB pe fiecare mesaj
// până apare contul. Odată rezolvat la un id real, steady-state-ul e zero query suplimentar pentru oricine.
let ownerUserIdCache: string | null | undefined
let ownerResolveAttemptedAt = 0
const OWNER_RESOLVE_RETRY_MS = 60_000

async function isOwnerUser(userId: string): Promise<boolean> {
  if (!env.OWNER_EMAIL) return false
  if (ownerUserIdCache === userId) return true
  // Owner deja rezolvat la un id real ≠ acesta → nu e owner, fără query.
  if (ownerUserIdCache != null) return false
  // Nerezolvat (undefined) sau owner inexistent la ultima încercare (null) → reîncearcă, throttled.
  const now = Date.now()
  if (ownerUserIdCache === undefined || now - ownerResolveAttemptedAt > OWNER_RESOLVE_RETRY_MS) {
    ownerResolveAttemptedAt = now
    const owner = await authRepository.findUserByEmail(env.OWNER_EMAIL)
    ownerUserIdCache = owner?.id ?? null
  }
  return ownerUserIdCache === userId
}

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
// Owner-ul (OWNER_EMAIL) trece mereu, fără abonament.
export async function userHasEntitlement(userId: string): Promise<boolean> {
  if (await isOwnerUser(userId)) return true
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
// Owner-ul (OWNER_EMAIL) primește tier 'max' (toate funcțiile), ca să-și testeze produsul complet.
export async function userTier(userId: string): Promise<'pro' | 'max' | null> {
  if (await isOwnerUser(userId)) return 'max'
  const sub = await billingRepository.findByUserId(userId)
  return subTier(sub)
}

// Plafon de răspunsuri AI pe lună calendaristică, derivat din tier (Etapa 2.2a, pas 2).
// Pro (și legacy/grandfathered, tratat ca Pro) = plafonat; Max = nelimitat.
export const PRO_MONTHLY_AI_LIMIT = 1200

// `null` = nelimitat (Max). Pentru orice altceva (Pro, legacy, fără tier) → plafonul Pro.
// Fail-closed pe cost: doar 'max' explicit primește nelimitat.
export function monthlyAiLimit(tier: 'pro' | 'max' | null): number | null {
  return tier === 'max' ? null : PRO_MONTHLY_AI_LIMIT
}

// Pârghii de tier (Etapa 2.2a, pas 3), valori din docs/SUBSCRIPTION_PLAN.md §1. Toate fail-closed:
// orice nu e 'max' explicit (Pro, legacy, null) primește limita Pro (cea mai restrictivă).

// Plafon produse în catalog.
export const PRODUCT_LIMIT = { pro: 100, max: 1000 } as const
export function productLimit(tier: 'pro' | 'max' | null): number {
  return tier === 'max' ? PRODUCT_LIMIT.max : PRODUCT_LIMIT.pro
}

// Plafon TOTAL fragmente RAG per user (bază de cunoștințe).
export const RAG_CHUNK_LIMIT = { pro: 500, max: 2000 } as const
export function ragChunkLimit(tier: 'pro' | 'max' | null): number {
  return tier === 'max' ? RAG_CHUNK_LIMIT.max : RAG_CHUNK_LIMIT.pro
}

// Timer minim de inactivitate (minute). Max poate coborî la 1 min (răspuns AI mai rapid); Pro min 5.
export const MIN_TIMER_MINUTES = { pro: 5, max: 1 } as const
export function minTimerMinutes(tier: 'pro' | 'max' | null): number {
  return tier === 'max' ? MIN_TIMER_MINUTES.max : MIN_TIMER_MINUTES.pro
}

// Felia 2 (2.2b): vision (citire poze) doar pe Max. Fail-closed: orice ≠'max' → fără vision.
export function visionAllowed(tier: 'pro' | 'max' | null): boolean {
  return tier === 'max'
}

// Felia 2 (2.2b): mai multe servicii într-o singură programare doar pe Max. Pro = 1 serviciu/programare.
export function multiServiceAllowed(tier: 'pro' | 'max' | null): boolean {
  return tier === 'max'
}
