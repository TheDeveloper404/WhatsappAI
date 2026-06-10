// Parser CSV minimal, fără dependențe. Gestionează:
// - separator virgulă sau punct-și-virgulă (detectat automat din header)
// - câmpuri între ghilimele cu virgule/newline interne ("a, b")
// - ghilimele escapate prin dublare ("")
// Returnează array de obiecte cu cheile din rândul header (lowercase, trimmed).

function detectDelimiter(headerLine: string): ',' | ';' {
  // Dacă apar mai multe ; decât , pe header, presupunem ; (export Excel RO/EU)
  const commas = (headerLine.match(/,/g) ?? []).length
  const semis = (headerLine.match(/;/g) ?? []).length
  return semis > commas ? ';' : ','
}

export function parseCsv(text: string): Record<string, string>[] {
  // Normalizează newline-urile și elimină BOM-ul (Excel adaugă ﻿ la început)
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Delimitator: detectat din prima linie LOGICĂ (până la primul newline din afara ghilimelelor).
  let q = false, firstLineEnd = clean.length
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '"') q = !q
    else if (clean[i] === '\n' && !q) { firstLineEnd = i; break }
  }
  const delim = detectDelimiter(clean.slice(0, firstLineEnd))

  // Mașină de stări pe TOT textul: un newline contează ca sfârșit de rând DOAR în afara ghilimelelor,
  // deci câmpurile citate pot conține virgule ȘI newline-uri interne (ce promitea comentariul vechi).
  const records: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cur += '"'; i++ } // ghilimea escapată prin dublare
        else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delim) { row.push(cur); cur = '' }
    else if (ch === '\n') { row.push(cur); cur = ''; records.push(row); row = [] }
    else cur += ch
  }
  row.push(cur)
  records.push(row)

  // Ignoră rândurile complet goale (inclusiv un newline final).
  const nonEmpty = records.filter(r => r.some(c => c.trim() !== ''))
  if (nonEmpty.length < 2) return []

  const headers = nonEmpty[0].map(h => h.trim().toLowerCase())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < nonEmpty.length; i++) {
    const cells = nonEmpty[i].map(c => c.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? '' })
    rows.push(row)
  }
  return rows
}

// Mapează rândurile CSV la produse. Acceptă mai multe denumiri de coloane (RO/EN).
// Returnează produsele valide + erorile pe rânduri (pentru feedback utilizator).
export type ParsedProduct = { name: string; description: string; priceLei: number; category: string; isAvailable: boolean; isEstimate: boolean; isBookable: boolean }

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k]
  }
  return ''
}

// Parsează un preț tolerant la formate RO/EU/EN. Regula: zecimala = ULTIMUL separator (. sau ,)
// care apare; celălalt e separator de mii și se elimină. Așa „1.299,00"→1299, „1,299.00"→1299,
// „49,99"→49.99, „49.99"→49.99. NOTĂ: un singur separator cu 3 cifre după (ex. „2.500") rămâne
// AMBIGUU (2.5 sau 2500?) — nu-l putem dezambigua fără locale; preview-ul de import îl arată owner-ului.
export function parsePriceLei(raw: string): number {
  const s = raw.replace(/[^\d.,-]/g, '')
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized: string
  if (lastComma > lastDot) {
    // virgula e zecimala (EU): scoate punctele (mii), virgula → punct
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // punctul e zecimala (EN/simplu): scoate virgulele (mii)
    normalized = s.replace(/,/g, '')
  } else {
    normalized = s // niciun separator
  }
  return parseFloat(normalized)
}

export function rowsToProducts(rows: Record<string, string>[]): { products: ParsedProduct[]; errors: string[] } {
  const products: ParsedProduct[] = []
  const errors: string[] = []

  rows.forEach((row, idx) => {
    const lineNo = idx + 2 // +2: rândul 1 e header, index de la 0
    const name = pick(row, ['nume', 'name', 'produs', 'product', 'denumire'])
    const priceRaw = pick(row, ['pret', 'preț', 'price', 'pret_lei', 'lei'])

    if (!name) { errors.push(`Rândul ${lineNo}: lipsește numele.`); return }
    if (!priceRaw) { errors.push(`Rândul ${lineNo}: lipsește prețul.`); return }

    const priceLei = parsePriceLei(priceRaw)
    if (isNaN(priceLei) || priceLei < 0) { errors.push(`Rândul ${lineNo}: preț invalid ("${priceRaw}").`); return }

    const availRaw = pick(row, ['disponibil', 'available', 'stoc', 'activ']).toLowerCase()
    // Implicit disponibil; doar valori explicit negative îl ascund
    const isAvailable = !['nu', 'no', 'false', '0', 'indisponibil', 'inactiv'].includes(availRaw)

    const estimateRaw = pick(row, ['estimativ', 'estimate', 'de la', 'pret_de_la']).toLowerCase()
    // Implicit preț fix; doar valori explicit afirmative îl marchează estimativ
    const isEstimate = ['da', 'yes', 'true', '1', 'estimativ'].includes(estimateRaw)

    const bookableRaw = pick(row, ['rezervabil', 'bookable', 'programare']).toLowerCase()
    // Implicit fără programare; doar valori explicit afirmative îl marchează rezervabil
    const isBookable = ['da', 'yes', 'true', '1', 'rezervabil'].includes(bookableRaw)

    products.push({
      name: name.slice(0, 120),
      description: pick(row, ['descriere', 'description', 'detalii']).slice(0, 500),
      priceLei,
      category: pick(row, ['categorie', 'category', 'tip']).slice(0, 60),
      isAvailable,
      isEstimate,
      isBookable,
    })
  })

  return { products, errors }
}
