'use client'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium rounded-xl transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-acid/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none font-mono-ui tracking-wide'

    const variants = {
      primary: 'bg-acid text-white dark:text-black hover:opacity-90 active:scale-[0.98]',
      // CTA inversat „standout" (cardul Max): alb/negru flip pe temă, definit prin token --cta-max.
      accent: 'bg-(--cta-max) text-(color:--cta-max-fg) hover:opacity-90 active:scale-[0.98]',
      secondary: 'border border-line bg-cardhi text-ink hover:bg-card',
      ghost: 'text-dim hover:bg-cardhi hover:text-ink',
      danger: 'bg-(--danger) text-white hover:opacity-90',
    }

    const sizes = {
      sm: 'h-8 px-3 text-[12px]',
      md: 'h-10 px-4 text-[13px]',
      lg: 'h-11 px-6 text-[14px]',
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
