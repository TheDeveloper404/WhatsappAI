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
  notFound: (resource = 'Resource') =>
    new AppError(404, 'NOT_FOUND', `${resource} not found`),
  conflict: (msg: string) =>
    new AppError(409, 'CONFLICT', msg),
  unprocessable: (msg: string) =>
    new AppError(422, 'UNPROCESSABLE', msg),
  rateLimited: () =>
    new AppError(429, 'RATE_LIMITED', 'Too many requests, slow down.'),
  internal: (msg = 'An unexpected error occurred') =>
    new AppError(500, 'INTERNAL_ERROR', msg),
}
