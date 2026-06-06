import { eq, and, gt, lt, isNull } from 'drizzle-orm'
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

  async findUserByDeletionToken(tokenHash: string): Promise<User | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.deletionToken, tokenHash), gt(users.deletionTokenExpiry!, Date.now())))
    return rows[0]
  },

  async saveRefreshToken(id: string, userId: string, tokenHash: string, expiresAt: Date, familyId: string): Promise<void> {
    await db.insert(refreshTokens).values({
      id,
      userId,
      tokenHash,
      familyId,
      expiresAt: expiresAt.getTime(),
      createdAt: Date.now(),
    })
  },

  // Claim atomic al unui refresh token VALID, nerotat, neexpirat (L10 + L13). În loc să ștergem rândul
  // (rotație simplă), îl MARCĂM `rotated_at` și îl păstrăm pentru detecția de reuse. UPDATE-ul cu
  // `rotated_at IS NULL` e atomic la nivel de rând: din două cereri concurente cu același token, doar
  // PRIMA primește rândul (RETURNING), a doua primește 0 (rotated_at deja setat) → exact un câștigător.
  async claimRefreshToken(tokenHash: string): Promise<{ userId: string; familyId: string | null } | undefined> {
    const rows = await db.update(refreshTokens)
      .set({ rotatedAt: Date.now() })
      .where(and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.rotatedAt),
        gt(refreshTokens.expiresAt, Date.now()),
      ))
      .returning({ userId: refreshTokens.userId, familyId: refreshTokens.familyId })
    return rows[0]
  },

  // Caută rândul după hash INDIFERENT de stare (rotat / expirat) — pentru a inspecta de ce a eșuat
  // un claim (reuse al unui token deja rotat vs token inexistent).
  async findRefreshTokenAny(tokenHash: string) {
    const rows = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash))
    return rows[0]
  },

  async deleteRefreshToken(tokenHash: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash))
  },

  // Revocă întreaga familie (lanțul de rotații al unei autentificări). Folosit la reuse detectat (L10)
  // și la logout (invalidează tot lanțul, nu doar tokenul curent).
  async revokeFamily(familyId: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.familyId, familyId))
  },

  async deleteAllRefreshTokensForUser(userId: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
  },

  // Curăță rândurile expirate (rotate sau nu). Necesar fiindcă tokenii rotați se păstrează pentru
  // detecția de reuse până la expirarea naturală, deci nu mai sunt șterși la rotație ca înainte.
  async cleanExpiredRefreshTokens(): Promise<void> {
    await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, Date.now()))
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

  // Ștergere imediată și definitivă a contului. FK-urile cu ON DELETE CASCADE curăță
  // automat toate datele asociate (produse, comenzi, conversații, sesiuni WhatsApp,
  // knowledge, leads, abonament, refresh tokens). Fără fereastră de grație — ireversibil.
  async deleteAccount(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId))
  },
}
