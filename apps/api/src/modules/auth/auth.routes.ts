import type { FastifyInstance } from 'fastify'
import { authController } from './auth.controller.js'

const rl = (max: number, timeWindow: string) =>
  process.env.NODE_ENV === 'test' || process.env.E2E_MODE === 'true'
    ? {}
    : { config: { rateLimit: { max, timeWindow } } }

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', rl(5, '10 minutes'), authController.register)
  app.post('/login', rl(10, '15 minutes'), authController.login)
  app.post('/logout', authController.logout)
  app.post('/refresh', authController.refresh)
  app.post('/verify-email', rl(10, '10 minutes'), authController.verifyEmail)
  app.post('/forgot-password', rl(3, '10 minutes'), authController.forgotPassword)
  app.post('/reset-password', rl(5, '10 minutes'), authController.resetPassword)
}
