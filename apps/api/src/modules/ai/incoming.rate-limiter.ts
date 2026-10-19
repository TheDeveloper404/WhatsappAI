// Cost-cap anti-flood pe mesajele PRIMITE. Fiecare mesaj de la un contact declanșează 1-2 apeluri
// LLM (răspuns + memorie) plus transcriere audio — pe cheia ta OpenRouter. Un contact ostil
// poate inunda numărul și goli bugetul.
//
// Limităm câte mesaje primite declanșează pipeline-ul AI, pe fereastră glisantă, pe DOUĂ niveluri:
//  - per contact: oprește un singur număr care spamează;
//  - agregat: plafonează costul total chiar dacă spam-ul vine de la multe numere.
//
// In-memory — un restart resetează contoarele, acceptabil pentru atenuare de abuz.

const perContact = new Map<string, number[]>() // cheie: `${userId}:${contactPhone}` → timestamps ms
const perUser = new Map<string, number[]>()     // cheie: userId → timestamps ms

// Praguri generoase pentru trafic legitim, dar care taie flood-ul. Ajustabile dacă e nevoie.
const CONTACT_MAX = 20
const CONTACT_WINDOW_MS = 10 * 60_000 // 20 mesaje / 10 min / contact
const USER_MAX = 120
const USER_WINDOW_MS = 60 * 60_000    // 120 mesaje / oră / user (toate contactele la un loc)

// Elimină timestamp-urile mai vechi decât cutoff (array-ul e mereu sortat crescător: push la final).
function prune(arr: number[], cutoff: number): number[] {
  let i = 0
  while (i < arr.length && arr[i] < cutoff) i++
  return i > 0 ? arr.slice(i) : arr
}

// Întoarce true dacă mesajul are voie să declanșeze pipeline-ul AI (și înregistrează „lovitura").
// false = peste prag → apelantul trebuie să renunțe la procesare (fără cost LLM).
export function allowIncomingMessage(userId: string, contactPhone: string, now: number = Date.now()): boolean {
  const cKey = `${userId}:${contactPhone}`
  const cArr = prune(perContact.get(cKey) ?? [], now - CONTACT_WINDOW_MS)
  const uArr = prune(perUser.get(userId) ?? [], now - USER_WINDOW_MS)

  if (cArr.length >= CONTACT_MAX || uArr.length >= USER_MAX) {
    // Re-stocăm doar array-urile încă relevante; nu păstrăm intrări goale (evită creșterea memoriei).
    if (cArr.length) perContact.set(cKey, cArr); else perContact.delete(cKey)
    if (uArr.length) perUser.set(userId, uArr); else perUser.delete(userId)
    return false
  }

  cArr.push(now); perContact.set(cKey, cArr)
  uArr.push(now); perUser.set(userId, uArr)
  return true
}
