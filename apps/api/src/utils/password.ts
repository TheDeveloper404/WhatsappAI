import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// Hash dummy de cost identic (12 runde), calculat o singură dată la încărcarea modulului.
const DUMMY_HASH = bcrypt.hashSync('constant-time-dummy-do-not-use', SALT_ROUNDS)

// Rulează un bcrypt de aceeași durată ca o verificare reală, ca să NU trădeze prin timing faptul
// că un cont nu există (M6 — anti-enumerare). Se apelează pe ramura „user inexistent" la login.
export async function verifyPasswordDummy(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH)
}
