import { z } from 'zod'
import { isDisposableEmail } from '../../utils/disposable-email.js'

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(255).transform(v => v.toLowerCase())
    // Blocăm emailurile de unică folosință (anti-spam la înregistrare).
    .refine(v => !isDisposableEmail(v), 'Folosește o adresă de email permanentă (nu una temporară).'),
  password: z
    .string()
    .min(8)
    .max(128) // bcrypt trunchiază la 72 bytes; limită explicită (L2/L11) — evită input nelimitat
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  // Honeypot anti-bot: câmp ascuns pe care oamenii NU îl completează. Dacă vine cu conținut, e un bot
  // → validarea pică (lungime max 0). Real users îl trimit gol sau deloc.
  website: z.string().max(0).optional(),
})

export const loginSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(1),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .max(128) // bcrypt trunchiază la 72 bytes; limită explicită (L2/L11) — evită input nelimitat
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
