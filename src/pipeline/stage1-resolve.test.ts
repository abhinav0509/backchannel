import { describe, expect, it } from 'vitest'
import { gate, type ResolveOut } from './stage1-resolve.js'

const out = (confidence: number | null, domain = 'example.com'): ResolveOut => ({
  candidates: [],
  gaps: [],
  identity:
    confidence === null
      ? null
      : ({ domain, resolution_confidence: confidence } as ResolveOut['identity']), // only the fields gate reads
})

describe('gate', () => {
  it('passes at or above 0.8', () => expect(gate(out(0.8))).toBe('pass'))
  it('asks below 0.8', () => expect(gate(out(0.79))).toBe('ask'))
  it('asks when no identity could be sourced', () => expect(gate(out(null))).toBe('ask'))
  it('passes a user-chosen domain that matches, whatever the confidence', () => expect(gate(out(0.3), 'example.com')).toBe('pass'))
  it('flags a user-chosen domain that research did not land on', () => expect(gate(out(0.95), 'other.com')).toBe('mismatch'))
})

it('the extraction task keeps identity whenever a candidate exists, nulling only unsourced facts', async () => {
  const { resolveTask } = await import('./stage1-resolve.js')
  expect(resolveTask()).toMatch(/null only if there is no candidate/i)
  expect(resolveTask('example.com')).toContain('example.com')
  expect(resolveTask()).toMatch(/reason: one plain sentence.*no \[n\] markers/i)
})
