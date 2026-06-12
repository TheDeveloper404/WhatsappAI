'use client'
import { forwardRef, useRef, useState } from 'react'
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
    const innerRef = useRef<HTMLInputElement>(null)
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
    const isPassword = type === 'password'
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

    // Combină ref-ul intern cu cel forwardat (avem nevoie de acces intern pt. fix-ul Safari).
    const setRefs = (el: HTMLInputElement | null) => {
      innerRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el
    }

    // Safari (iOS/iPadOS) nu repaintează un câmp `password` neforfocusat când îi schimbi `type`;
    // punctele rămân până la refocus. Reasignăm `value` într-un rAF ca să forțăm re-randarea,
    // fără să deschidem tastatura (nu apelăm focus()).
    const togglePassword = () => {
      setShowPassword(v => !v)
      requestAnimationFrame(() => {
        const el = innerRef.current
        if (!el) return
        const start = el.selectionStart
        const end = el.selectionEnd
        const val = el.value
        el.value = ''
        el.value = val
        try { el.setSelectionRange(start, end) } catch { /* unele tipuri nu suportă selecție */ }
      })
    }

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-[13px] font-medium text-dim font-mono-ui tracking-wide">
          {label}
        </label>
        <div className="relative">
          <input
            ref={setRefs}
            id={inputId}
            type={inputType}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            aria-invalid={!!error}
            className={cn(
              'w-full rounded-xl border px-3.5 py-2.5 text-[16px] text-ink placeholder:text-dimmer',
              'bg-cardhi focus:outline-hidden focus:ring-2 focus:ring-acid/40 focus:border-acid',
              'transition-[border-color,box-shadow]',
              error ? 'border-(--danger) bg-red-50 dark:bg-red-950/20' : 'border-line hover:border-acid/40',
              isPassword && 'pr-10',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              // preventDefault pe mousedown: butonul nu mai fură focus-ul din input,
              // deci dacă userul tocmai scria, câmpul rămâne focusat și Safari repaintează live.
              onMouseDown={e => e.preventDefault()}
              onClick={togglePassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-ink transition-colors"
              aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-[12px] text-(--danger)" role="alert">
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
