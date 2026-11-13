import { defineConfig } from 'vitest/config'

// PGlite boots a real Postgres in WASM; under load (e.g. a concurrent build) that can exceed the 5s default.
export default defineConfig({ test: { testTimeout: 20_000, hookTimeout: 30_000 } })
