'use client'
import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, type, className, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
    const isPassword = type === 'password'
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-[13px] font-medium text-dim font-mono-ui tracking-wide">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            aria-invalid={!!error}
            className={cn(
              'w-full rounded-xl border px-3.5 py-2.5 text-[14px] text-ink placeholder:text-dimmer',
              'bg-cardhi focus:outline-none focus:ring-2 focus:ring-acid/40 focus:border-acid',
              'transition-[border-color,box-shadow]',
              error ? 'border-[var(--danger)] bg-red-50 dark:bg-red-950/20' : 'border-line hover:border-acid/40',
              isPassword && 'pr-10',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dimmer hover:text-dim transition-colors"
              aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-[12px] text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-[11.5px] text-dimmer">
            {hint}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
