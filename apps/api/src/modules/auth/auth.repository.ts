import { eq, and, gt, lt } from 'drizzle-orm'
import { db } from '../../config/database.js'
import { users, refreshTokens, loginAttempts, type User, type NewUser } from '../../db/schema.js'

export const authRepository = {
  async createUser(data: NewUser): Promise<User> {
    await db.insert(users).values(data)
    const rows = await db.select().from(users).where(eq(users.id, data.id))
    return rows[0]!
  },

  async findUserByEmail(email: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.email, email))
    return rows[0]
  },

  async findUserById(id: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id))
    return rows[0]
  },

  async updateUser(id: string, data: Partial<User>): Promise<void> {
    await db.update(users).set({ ...data, updatedAt: Date.now() }).where(eq(users.id, id))
  },

  async findUserByVerifyToken(token: string): Promise<User | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.emailVerifyToken, token), gt(users.emailVerifyTokenExpiry!, Date.now())))
    return rows[0]
  },

  async findUserByResetToken(tokenHash: string): Promise<User | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.resetPasswordToken, tokenHash), gt(users.resetPasswordTokenExpiry!, Date.now())))
    return rows[0]
  },

  async saveRefreshToken(id: string, userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await db.insert(refreshTokens).values({
      id,
      userId,
      tokenHash,
      expiresAt: expiresAt.getTime(),
      createdAt: Date.now(),
    })
  },

  async findRefreshToken(tokenHash: string) {
    const rows = await db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, tokenHash), gt(refreshTokens.expiresAt, Date.now())))
    return rows[0]
  },

  async deleteRefreshToken(tokenHash: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash))
  },

  async deleteAllRefreshTokensForUser(userId: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
  },

  async countRecentLoginAttempts(email: string, since: Date): Promise<number> {
    const rows = await db
      .select()
      .from(loginAttempts)
      .where(and(eq(loginAttempts.email, email), gt(loginAttempts.createdAt, since.getTime())))
    return rows.length
  },

  async logLoginAttempt(id: string, email: string, ip: string): Promise<void> {
    await db.insert(loginAttempts).values({ id, email, ip, createdAt: Date.now() })
  },

  async cleanOldLoginAttempts(): Promise<void> {
    const cutoff = Date.now() - 15 * 60 * 1000
    await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, cutoff))
  },
}
