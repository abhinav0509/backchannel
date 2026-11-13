import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cacheKey, readCache, writeCache } from './cache.js'

describe('cache', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'bc-cache-'))

  it('keys are stable for equal input and differ for any change', () => {
    expect(cacheKey({ a: 1, b: [2] })).toBe(cacheKey({ a: 1, b: [2] }))
    expect(cacheKey({ a: 1, b: [2] })).not.toBe(cacheKey({ a: 1, b: [3] }))
    expect(cacheKey({ a: 1 })).toMatch(/^[0-9a-f]{64}$/)
  })

  it('round-trips a value and misses on an unknown key', () => {
    const d = dir()
    expect(readCache(d, 'nope')).toBeUndefined()
    writeCache(d, 'k', { x: [1, 2] })
    expect(readCache(d, 'k')).toEqual({ x: [1, 2] })
  })
})
