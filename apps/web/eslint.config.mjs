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
      // Reguli „React Compiler" din eslint-plugin-react-hooks v6 (intrate cu eslint-config-next 16).
      // Curățenia 0.5 (livrată): cele 20 findings rezolvate — refactor real unde era curat (theme via
      // useSyncExternalStore, derivare în render, lazy-init) + `eslint-disable` documentat unde efectul e
      // pattern-ul SSR-corect (citire localStorage/sessionStorage/hash la mount, fetch on mount cu setState
      // post-await, auth-gate). Acum pe `error` → orice regresie sparge build-ul.
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/immutability': 'error',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])
