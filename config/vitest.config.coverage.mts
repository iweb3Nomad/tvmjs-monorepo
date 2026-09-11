import { defineConfig } from 'vitest/config'

const config = defineConfig({
  test: {
    exclude: ['**/test/_*.spec.ts'],
    silent: true,
    testTimeout: 180000,
    coverage: {
      provider: 'v8',
      enabled: true,
      all: true,
      include: ['src/**'],
      reportsDirectory: './coverage/v8',
    },
  },
})

export default config