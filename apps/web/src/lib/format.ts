// Formatare monedă pentru afișare. Banii sunt stocați ca integer (subunitate);
// aici doar împărțim la 100 și atașăm eticheta monedei businessului.
// Conversie valutară NU se face — fiecare business are o singură monedă.

export type Currency = 'RON' | 'EUR' | 'USD' | 'GBP'

export const CURRENCIES: Currency[] = ['RON', 'EUR', 'USD', 'GBP']

// Eticheta afișată după sumă (ex: 100,00 lei / 100,00 €). RON folosește „lei" (uzual în RO).
const CURRENCY_LABEL: Record<Currency, string> = {
  RON: 'lei',
  EUR: '€',
  USD: '$',
  GBP: '£',
}

export function currencyLabel(currency: string): string {
  return CURRENCY_LABEL[(currency as Currency)] ?? currency
}

// Doar suma formatată, fără etichetă (pentru cazuri în care eticheta e separată stilistic).
export function formatAmount(bani: number): string {
  return (bani / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Sumă + etichetă monedă (ex: „100,00 lei").
export function formatMoney(bani: number, currency: string): string {
  return `${formatAmount(bani)} ${currencyLabel(currency)}`
}
