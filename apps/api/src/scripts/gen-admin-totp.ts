import { generateSecret, generateURI } from 'otplib'

// Generează un secret TOTP pentru autentificarea în 2 pași a panoului admin.
// Rulează O SINGURĂ DATĂ local, apoi:
//   1. introdu secretul base32 în Google Authenticator / Authy ("Enter a setup key"),
//      SAU deschide otpauth:// URI-ul de mai jos într-un generator de QR și scanează-l;
//   2. pune secretul în Railway ca env var `ADMIN_TOTP_SECRET`;
//   3. de la următorul deploy, login-ul admin cere și codul de 6 cifre.
//
// Usage: tsx src/scripts/gen-admin-totp.ts [label]

const label = process.argv[2] ?? 'admin'
const secret = generateSecret()
const uri = generateURI({ issuer: 'WhatsApp AI', label, secret })

console.log('')
console.log('  Secret TOTP (base32) — pune-l în Railway ca ADMIN_TOTP_SECRET:')
console.log('')
console.log(`    ${secret}`)
console.log('')
console.log('  otpauth:// URI (deschide-l într-un generator de QR pentru scanare):')
console.log('')
console.log(`    ${uri}`)
console.log('')
console.log('  Introducere manuală în Authenticator: tip = Time based, cheie = secretul de mai sus.')
console.log('')

process.exit(0)
