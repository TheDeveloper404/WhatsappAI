import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    // Rulează DOAR testele din src/. Excludem build-ul compilat din dist/ — altfel vitest prinde
    // și `dist/**/*.test.js` (cod VECHI, dinainte de modificări) și raportează eșecuri fantomă.
    exclude: [...configDefaults.exclude, 'dist/**'],
    env: {
      NODE_ENV: 'test',
      PORT: '3001',
      JWT_ACCESS_SECRET: 'test_access_secret_minimum_32_characters_long',
      JWT_REFRESH_SECRET: 'test_refresh_secret_minimum_32_characters_long',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      DATABASE_URL: 'postgresql://localhost/whatsapp_ai_test',
      RESEND_API_KEY: 'test_resend_key',
      EMAIL_FROM: 'test@example.com',
      APP_URL: 'http://localhost:3000',
      API_URL: 'http://localhost:3001',
      STRIPE_SECRET_KEY: 'sk_test_placeholder_for_tests',
      STRIPE_PRICE_MONTHLY_ID: 'price_test_monthly',
      STRIPE_PRICE_ANNUAL_ID: 'price_test_annual',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_webhook_secret_placeholder',
      GROQ_API_KEY: 'test_groq_key_placeholder',
      ADMIN_SECRET: 'test_admin_secret_minimum_32_chars_here',
      ADMIN_EMAIL: 'admin@test.example.com',
    },
  },
})
