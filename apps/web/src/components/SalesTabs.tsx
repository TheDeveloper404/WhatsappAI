'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, CalendarClock } from 'lucide-react'

// Tab-uri pentru secțiunea „Vânzări" — Catalog / Comenzi / Programări.
// Tab-uri pe bază de link (fiecare e o rută proprie): back/deep-link funcționează,
// iar paginile rămân componente independente cu fetch-ul lor.
const SALES_TABS = [
  { href: '/products', label: 'Catalog', icon: Package },
  { href: '/orders', label: 'Comenzi', icon: ShoppingCart },
  { href: '/appointments', label: 'Programări', icon: CalendarClock },
]

export function SalesTabs() {
  const pathname = usePathname()
  return (
    <div className="mb-6 flex items-center gap-1 border-b border-line">
      {SALES_TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-4 py-2.5 font-mono-ui text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
              active ? 'border-acid text-ink' : 'border-transparent text-dim hover:text-ink'
            }`}
          >
            <Icon className={`h-4 w-4 ${active ? 'text-acid' : ''}`} />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
