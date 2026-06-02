'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Flame } from 'lucide-react'

// Tab-uri pentru secțiunea „Conversații" — Mesaje / Lead-uri.
// Tab-uri pe bază de link (rute proprii): paginile rămân independente cu fetch-ul lor.
const INBOX_TABS = [
  { href: '/conversations', label: 'Conversații', icon: MessageSquare },
  { href: '/leads', label: 'Lead-uri', icon: Flame },
]

export function ConversationsTabs() {
  const pathname = usePathname()
  return (
    <div className="mb-6 flex items-center gap-1 border-b border-line">
      {INBOX_TABS.map(({ href, label, icon: Icon }) => {
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
