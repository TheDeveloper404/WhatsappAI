import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Rulează DOAR testele din src/ (nu build-ul vechi din dist/).
    exclude: [...configDefaults.exclude, 'dist/**'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://127.0.0.1:5432/whatsapp_ai_test',
      OPENROUTER_API_KEY: 'test_openrouter_key',
      LLM_MODEL: 'test/model',
      LLM_AUDIO_MODEL: 'test/audio-model',
    },
  },
})
