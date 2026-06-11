export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: { field: string; message: string }[]
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const Errors = {
  validation: (details: { field: string; message: string }[]) =>
    new AppError(400, 'VALIDATION_ERROR', 'Validation failed', details),
  unauthorized: (msg = 'Invalid credentials') =>
    new AppError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'Access denied') =>
    new AppError(403, 'FORBIDDEN', msg),
  // 402 distinct de 401/403: clientul îl mapează la „du-te la /subscribe", nu la „sesiune expirată".
  subscriptionRequired: (msg = 'Active subscription required.') =>
    new AppError(402, 'SUBSCRIPTION_REQUIRED', msg),
  // 403 (NU 402): userul ARE abonament valid, dar nu tier-ul cerut de funcția asta. Clientul îl
  // mapează la „upgrade la Max", nu la „abonează-te".
  tierRequired: (msg = 'This feature requires a higher plan.') =>
    new AppError(403, 'TIER_REQUIRED', msg),
  notFound: (resource = 'Resource') =>
    new AppError(404, 'NOT_FOUND', `${resource} not found`),
  conflict: (msg: string) =>
    new AppError(409, 'CONFLICT', msg),
  unprocessable: (msg: string) =>
    new AppError(422, 'UNPROCESSABLE', msg),
  rateLimited: () =>
    new AppError(429, 'RATE_LIMITED', 'Too many requests, slow down.'),
  // Challenge anti-bot la login după N eșecuri (0.7, varianta C — anti account-lockout DoS). Cod distinct
  // de 401 generic: frontend-ul îl mapează la „arată widget-ul Turnstile și reîncearcă", NU la „parolă greșită".
  captchaRequired: (msg = 'Verificare de securitate necesară. Confirmă că nu ești robot și reîncearcă.') =>
    new AppError(401, 'CAPTCHA_REQUIRED', msg),
  internal: (msg = 'An unexpected error occurred') =>
    new AppError(500, 'INTERNAL_ERROR', msg),
}
