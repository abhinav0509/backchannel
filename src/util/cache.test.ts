import { beforeEach, describe, expect, it } from 'vitest'
import { useTestDb } from '../db/db'
import { cacheGet, cacheKey, cacheSet } from './cache'

beforeEach(async () => {
  await useTestDb()
})

describe('cache', () => {
  it('keys are stable for equal input and differ for any change', () => {
    expect(cacheKey({ a: 1, b: [2] })).toBe(cacheKey({ a: 1, b: [2] }))
    expect(cacheKey({ a: 1, b: [2] })).not.toBe(cacheKey({ a: 1, b: [3] }))
    expect(cacheKey({ a: 1 })).toMatch(/^[0-9a-f]{64}$/)
  })

  it('round-trips a value in the database and misses on an unknown key', async () => {
    expect(await cacheGet('nope')).toBeUndefined()
    await cacheSet('k', { x: [1, 2] })
    expect(await cacheGet('k')).toEqual({ x: [1, 2] })
  })

  it('overwrites an existing key', async () => {
    await cacheSet('k', 1)
    await cacheSet('k', 2)
    expect(await cacheGet('k')).toBe(2)
  })
})
