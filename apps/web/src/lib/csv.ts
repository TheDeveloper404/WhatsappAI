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

function parseLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === delim) { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

export function parseCsv(text: string): Record<string, string>[] {
  // Normalizează newline-urile și elimină BOM-ul (Excel adaugă ﻿ la început)
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter(l => l.trim() !== '')
  if (lines.length < 2) return []

  const delim = detectDelimiter(lines[0])
  const headers = parseLine(lines[0], delim).map(h => h.toLowerCase().trim())

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i], delim)
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

export function rowsToProducts(rows: Record<string, string>[]): { products: ParsedProduct[]; errors: string[] } {
  const products: ParsedProduct[] = []
  const errors: string[] = []

  rows.forEach((row, idx) => {
    const lineNo = idx + 2 // +2: rândul 1 e header, index de la 0
    const name = pick(row, ['nume', 'name', 'produs', 'product', 'denumire'])
    const priceRaw = pick(row, ['pret', 'preț', 'price', 'pret_lei', 'lei'])

    if (!name) { errors.push(`Rândul ${lineNo}: lipsește numele.`); return }
    if (!priceRaw) { errors.push(`Rândul ${lineNo}: lipsește prețul.`); return }

    const priceLei = parseFloat(priceRaw.replace(/[^\d.,-]/g, '').replace(',', '.'))
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
