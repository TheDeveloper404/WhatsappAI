// Sursa UNICĂ pentru tiere + prețuri afișate (Etapa 2.2a). Folosită de /subscribe (dashboard) și de
// secțiunea de prețuri din landing — nu hardcoda prețuri/feature-uri în pagini. Numerele decise:
// docs/SUBSCRIPTION_PLAN.md §6. Prețurile reale de checkout trăiesc în Stripe (price ID-uri în env-ul API);
// astea sunt DOAR pentru afișaj. Mapează 1:1 pe `STRIPE_PRICE_{PRO,MAX}_{MONTHLY,ANNUAL}`.

export type BillingPeriod = 'monthly' | 'annual'
export type TierId = 'pro' | 'max'

export interface TierPlan {
  id: TierId
  name: string
  tagline: string
  monthly: number // RON / lună
  annual: number // RON / an
  recommended: boolean
  features: string[]
}

export const TIERS: TierPlan[] = [
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Automatizare + vânzări de bază pentru un business mic.',
    monthly: 79,
    annual: 790,
    recommended: false,
    features: [
      'agent AI 24/7 în stilul tău',
      '~1.200 răspunsuri AI / lună',
      'catalog, comenzi & programări',
      'transcriere mesaje vocale',
      'knowledge base + 3 documente (RAG)',
      'alerte red-flag',
    ],
  },
  {
    id: 'max',
    name: 'Max',
    tagline: 'Tot ce e în Pro + AI premium și volum nelimitat.',
    monthly: 129,
    annual: 1290,
    recommended: true,
    features: [
      'tot ce include Pro, plus:',
      'răspunsuri AI nelimitate',
      'citire poze trimise de clienți (vision)',
      'calificare lead-uri (hot / warm / cold)',
      'statistici avansate',
      '10+ documente RAG & multi-serviciu',
      'email confirmare comandă',
      'suport prioritar < 24h + acces beta',
    ],
  },
]

// Anual = 2 luni gratis (≈17%). Folosit pentru badge + textul de economie.
export const ANNUAL_MONTHS_FREE = 2

export function perMonthFromAnnual(annual: number): number {
  return Math.round(annual / 12)
}

export function annualSavings(monthly: number, annual: number): number {
  return monthly * 12 - annual
}
