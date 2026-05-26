import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

interface AlertProps {
  type: 'error' | 'success' | 'info'
  message: string
  className?: string
}

const config = {
  error: { icon: AlertCircle, classes: 'bg-red-50 border-red-200 text-red-700' },
  success: { icon: CheckCircle2, classes: 'bg-green-50 border-green-200 text-green-700' },
  info: { icon: Info, classes: 'bg-blue-50 border-blue-200 text-blue-700' },
}

export function Alert({ type, message, className }: AlertProps) {
  const { icon: Icon, classes } = config[type]
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm', classes, className)} role="alert">
      <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  )
}
