import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [],

  test: {
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['lcov'],
    },
    exclude: [
      'test/tester/state.spec.ts',
      'test/tester/blockchain.spec.ts',
      'test/tester/consumeBal.test.ts',
    ],
  },
})
