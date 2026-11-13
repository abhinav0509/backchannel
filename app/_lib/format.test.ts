import { describe, expect, it } from 'vitest'
import { age, dimensionLabel, flagLabel, ownershipLabel, stageLabel, stagesFor, usd } from './format'

describe('age', () => {
  const now = new Date('2026-11-13T12:00:00Z')
  it.each([
    ['2026-11-13T11:59:40Z', 'Just now'],
    ['2026-11-13T11:55:00Z', '5 min ago'],
    ['2026-11-13T09:00:00Z', '3 h ago'],
    ['2026-11-11T12:00:00Z', '2 days ago'],
    ['2026-11-12T11:00:00Z', 'Yesterday'],
    ['2026-10-01T12:00:00Z', 'Oct 1'],
  ])('%s -> %s', (iso, want) => expect(age(iso, now)).toBe(want))
})

describe('usd', () => {
  it.each([[0, '$0.00'], [0.004, '<$0.01'], [0.214, '$0.21'], [1.029, '$1.03'], [20, '$20.00']])('%s -> %s', (n, s) => expect(usd(n)).toBe(s))
})

describe('labels', () => {
  it('names every flag kind in plain words', () => {
    expect(flagLabel('pe_ownership')).toBe('Private equity owner')
    expect(flagLabel('rto_change')).toBe('Office policy tightened')
    expect(flagLabel('layoff_history')).toBe('Layoff history')
  })
  it('names dimensions, ownership and stages for people, not for the system', () => {
    expect(dimensionLabel('comp_confidence')).toBe('Pay clarity')
    expect(ownershipLabel('pe_backed')).toBe('Private equity backed')
    expect(stageLabel('resolve')).toBe('Identifying the company')
  })
  it('lists the stages each mode runs, in order', () => {
    expect(stagesFor('triage')).toEqual(['parse', 'resolve', 'triage'])
    expect(stagesFor('deep')).toEqual(['parse', 'resolve', 'money', 'people', 'synthesize'])
  })
})
