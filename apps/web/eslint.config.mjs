import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Flat config (ESLint 9+) — înlocuiește `.eslintrc.json` (`--ext` eliminat → extensiile vin din `files`-urile
// config-urilor Next). Folosim exporturile native flat ale `eslint-config-next` 16 (fără shim FlatCompat).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      // Reguli NOI „React Compiler" din eslint-plugin-react-hooks v6 (intrate odată cu eslint-config-next 16).
      // ~20 findings pre-existente (setState în efect, ref/purity) — nu sunt bug-uri active (Next 16 nu lintează
      // la build, runtime OK), ci pregătire pt React Compiler. Lăsate pe `warn` (ne-blocante) → curățenie țintită
      // separată (vezi BACKLOG B13/web-6 follow-up). NU le seta pe error fără a repara întâi cele 13 fișiere.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])
