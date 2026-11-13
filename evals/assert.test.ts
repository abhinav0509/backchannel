import { describe, expect, it } from 'vitest'
import { check, get } from './assert'

const doc = {
  identity: { domain: 'example.com' },
  people: { layoff_events: [{}, {}] },
  flags: [{ kind: 'layoff_history' }, { kind: 'pe_ownership' }],
  gaps: ['Compensation data not found'],
}

describe('get', () => {
  it('reads nested paths', () => expect(get(doc, 'identity.domain')).toBe('example.com'))
  it('reads array length', () => expect(get(doc, 'people.layoff_events.length')).toBe(2))
  it('maps over arrays with []', () => expect(get(doc, 'flags[].kind')).toEqual(['layoff_history', 'pe_ownership']))
  it('returns undefined for a missing path', () => expect(get(doc, 'money.ownership_type.value')).toBeUndefined())
})

describe('check', () => {
  it('equality', () => {
    expect(check('a', 'a')).toBeNull()
    expect(check('b', 'a')).toMatch(/expected "a"/)
    expect(check(undefined, 'a')).not.toBeNull()
  })
  it('min / max', () => {
    expect(check(2, { min: 1 })).toBeNull()
    expect(check(0, { min: 1 })).toMatch(/>= 1/)
    expect(check(5, { max: 3 })).toMatch(/<= 3/)
    expect(check(undefined, { min: 1 })).toMatch(/number/)
  })
  it('contains', () => {
    expect(check(['a', 'b'], { contains: ['a'] })).toBeNull()
    expect(check(['a'], { contains: ['a', 'c'] })).toMatch(/missing \["c"\]/)
  })
  it('contains_match', () => {
    expect(check(doc.gaps, { contains_match: /compensation/i })).toBeNull()
    expect(check(doc.gaps, { contains_match: /revenue/i })).toMatch(/no entry/)
  })
})
