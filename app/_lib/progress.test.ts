import { describe, expect, it } from 'vitest'
import { estimate } from './progress'

describe('estimate', () => {
  it('starts at zero on the first step', () => expect(estimate(0, 100, 4)).toMatchObject({ fraction: 0, step: 0, slow: false }))

  it('moves through the steps over the expected time, never claiming the last is done', () => {
    expect(estimate(30, 100, 4).step).toBe(1)
    expect(estimate(99, 100, 4).step).toBe(3)
    expect(estimate(500, 100, 4).step).toBe(3)
  })

  it('eases toward the end without reaching it, and says when it is slower than usual', () => {
    const at = (s: number) => estimate(s, 100, 4).fraction
    expect(at(50)).toBeGreaterThan(at(25))
    expect(at(100)).toBeLessThan(0.95)
    expect(at(1000)).toBeLessThan(0.97)
    expect(estimate(130, 100, 4).slow).toBe(true)
    expect(estimate(90, 100, 4).slow).toBe(false)
  })

  it('is complete only when the work says it is done', () => expect(estimate(5, 100, 4, true)).toEqual({ fraction: 1, step: 4, slow: false }))
})
