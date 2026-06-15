#!/usr/bin/env node
// Dependency vulnerability gate (L15 — vezi docs/SECURITY_AUDIT.md).
//
// Rulează `pnpm audit --json`, păstrează doar advisory-urile de severitate >= prag
// (default `high`) și EXCLUDE cele deja cunoscute/triajate (baseline-ul de mai jos).
// Iese cu cod 1 DOAR dacă apare un advisory NOU peste prag → CI prinde regresii noi,
// nu re-semnalează la nesfârșit backlog-ul deja documentat.
//
// Independent de versiunea pnpm: nu depinde de `auditConfig` (a cărui locație/schemă
// diferă între pnpm 9 `ignoreCves` în package.json și pnpm 11 `ignoreGhsas` în YAML).
//
// La fiecare upgrade de dependență din docs/SECURITY_AUDIT.md (D1–D5), ȘTERGE intrarea
// corespunzătoare din BASELINE ca să reactivezi semnalarea dacă reapare.

import { spawnSync } from 'node:child_process'

const LEVELS = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 }
const THRESHOLD = LEVELS[process.env.AUDIT_LEVEL ?? 'high'] ?? LEVELS.high

// GHSA-uri cunoscute la 2026-06-03 (pnpm audit). Cheia = GHSA id, valoarea = nota de triaj.
const BASELINE = {
  'GHSA-gpj5-g38j-94v9': 'D1 drizzle-orm SQLi via identifiers (neexploatabil în codul actual)',
  'GHSA-jx2c-rxcm-jvmq': 'D2 fastify Content-Type tab bypass schema (atenuat de zod)',
  'GHSA-444r-cwp2-x5xf': 'D3 fastify protocol/host spoof X-Forwarded-* (pereche cu fix M1)',
  'GHSA-v6c2-xwv6-8xf7': 'D4 music-metadata buclă infinită ASF (DoS audio)',
  'GHSA-c4j6-fc7j-m34r': 'D5 next SSRF WebSocket (nu se aplică pe Vercel)',
  'GHSA-h25m-26qc-wcjf': 'D5 next DoS HTTP request deserialization',
  'GHSA-q4gf-8mx6-v5v3': 'D5 next DoS Server Components',
  'GHSA-8h8q-6873-q5fj': 'D5 next DoS Server Components',
  'GHSA-36qx-fr4f-26g5': 'D5 next middleware/proxy bypass (Pages)',
  'GHSA-5j98-mcp5-4vw2': 'glob CLI command injection (dev-only, via eslint-config-next)',
  'GHSA-q3j6-qgpj-74h6': 'fast-uri path traversal (tranzitiv via fastify)',
  'GHSA-v39h-62p7-jpjc': 'fast-uri host confusion (tranzitiv via fastify)',
  'GHSA-gv7w-rqvm-qjhr': 'esbuild RCE — DENO-ONLY (varianta Node/npm are binaryIntegrityCheck SHA-256); la noi e devDep tranzitiv de build/test, neexploatabil. Fixat în 0.28.1 (suntem pe 0.28.0).',
  // Sub pragul `high` (nu pică gate-ul la default), documentate pentru `AUDIT_LEVEL=moderate` — audit 2026-06-13:
  'GHSA-5v7r-6r5c-r473': 'file-type ASF infinite loop (DoS) — tranzitiv via Baileys, aceeași clasă ca music-metadata (D4); mărginit de throttle mesaje primite (H6). Upgrade prin Baileys.',
  'GHSA-qx2v-qp2m-jg93': 'postcss <8.5.10 XSS via </style> în CSS Stringify — bundled de next@16; vector build-time (nu procesăm CSS ostil la runtime). Se închide la bump-ul postcss din Next.',
  'GHSA-w5hq-g745-h8pq': 'uuid bounds check v3/v5/v6 cu `buf` — tranzitiv via Baileys; codul nostru folosește crypto.randomUUID (nu calea afectată).',
  'GHSA-g7r4-m6w7-qqqr': 'esbuild dev-server arbitrary file read — DEV-ONLY (nu rulează în prod).',
  'GHSA-fx2h-pf6j-xcff': 'vite server.fs.deny bypass pe Windows alternate paths — DEV/TEST-ONLY (tranzitiv via vitest/@vitest/coverage-v8; nu rulează în prod pe Railway/Vercel). ws (GHSA-96hv) și form-data (GHSA-hmw2) sunt în schimb fixate prin pnpm.overrides.',
}

function runAudit() {
  const res = spawnSync('pnpm', ['audit', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (res.error) {
    console.error('Nu am putut rula `pnpm audit`:', res.error.message)
    process.exit(2)
  }
  // pnpm audit întoarce un singur obiect JSON pe stdout (cod de ieșire != 0 când există vulns).
  const text = (res.stdout || '').trim()
  if (!text) {
    console.error('`pnpm audit --json` nu a produs ieșire. stderr:\n' + (res.stderr || ''))
    process.exit(2)
  }
  try {
    return JSON.parse(text)
  } catch {
    // Unele versiuni emit NDJSON (un obiect per linie) — ia ultimul obiect valid.
    const lines = text.split('\n').filter(Boolean)
    for (let i = lines.length - 1; i >= 0; i--) {
      try { return JSON.parse(lines[i]) } catch { /* continuă */ }
    }
    console.error('Nu am putut parsa ieșirea `pnpm audit --json`.')
    process.exit(2)
  }
}

const report = runAudit()
const advisories = Object.values(report.advisories ?? {})

const atOrAbove = advisories.filter((a) => (LEVELS[a.severity] ?? 0) >= THRESHOLD)
const unexpected = atOrAbove.filter((a) => !BASELINE[a.github_advisory_id])
const baselinedHit = atOrAbove.filter((a) => BASELINE[a.github_advisory_id])

const thresholdName = Object.keys(LEVELS).find((k) => LEVELS[k] === THRESHOLD)
console.log(`Audit dependențe — prag: ${thresholdName}+`)
console.log(`  advisory-uri peste prag: ${atOrAbove.length} (${baselinedHit.length} în baseline, ${unexpected.length} noi)`)

if (unexpected.length > 0) {
  console.error('\n❌ Advisory NOU peste prag (neacoperit de baseline):')
  for (const a of unexpected) {
    console.error(`  • [${a.severity}] ${a.module_name} — ${a.github_advisory_id}`)
    console.error(`    ${a.title}`)
    console.error(`    ${a.url}`)
  }
  console.error('\nTriază-l, apoi: fie upgrade-ul dependenței, fie adaugă GHSA în BASELINE din scripts/audit-check.mjs cu o notă.')
  process.exit(1)
}

console.log('\n✅ Niciun advisory nou peste prag. Backlog-ul cunoscut e în baseline (docs/SECURITY_AUDIT.md D1–D5).')
process.exit(0)
