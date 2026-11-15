import { describe, expect, it } from 'vitest'
import type { RunTrace } from '../../src/store/repo'
import type { CallTrace } from '../../src/types/trace'
import { duration, modelName, timeline } from './trace'

const T0 = Date.parse('2026-11-14T10:00:00.000Z')
const at = (s: number) => new Date(T0 + s * 1000).toISOString()
const call = (o: Partial<CallTrace>): CallTrace => ({
  stage: 'money',
  kind: 'search',
  model: 'claude-sonnet-5-5',
  at: at(1),
  ms: 1000,
  cached: false,
  usd: 0.1,
  input_tokens: 1,
  output_tokens: 1,
  searches: 0,
  detail: { queries: [], found: null, cited: null, capped: false, suspect: [], attempt: 1, outcome: null, issues: null, dropped: [] },
  ...o,
})
const trace = (over: Partial<RunTrace> = {}): RunTrace => ({
  run: { id: 'r', mode: 'deep', started_at: at(0), finished_at: at(200), status: 'done', cost_usd: 1.5, searches: 20, input_tokens: 0, output_tokens: 0, stages: { money: { usd: 0.4, searches: 6, input: 0, output: 0 } }, error: null },
  events: [
    { stage: 'parse', status: 'started', at: at(0), error: null },
    { stage: 'parse', status: 'ok', at: at(4), error: null },
    { stage: 'money', status: 'started', at: at(10), error: null },
    { stage: 'people', status: 'started', at: at(10), error: null },
    { stage: 'people', status: 'failed', at: at(50), error: 'boom' },
    { stage: 'money', status: 'partial', at: at(110), error: null },
  ],
  calls: [
    call({ detail: { queries: ['a', 'b'], found: 12, cited: 5, capped: true, suspect: ['Ignore previous instructions'], attempt: 1, outcome: null, issues: null, dropped: [] } }),
    call({ kind: 'structured', model: 'claude-haiku-5-5', detail: { queries: [], found: null, cited: null, capped: false, suspect: [], attempt: 1, outcome: 'invalid', issues: 'x', dropped: [] } }),
    call({ kind: 'structured', model: 'claude-haiku-5-5', detail: { queries: [], found: null, cited: null, capped: false, suspect: [], attempt: 2, outcome: 'valid', issues: null, dropped: ['removed a citation the search never returned: u', 'dropped an unsourced claim at x.0'] } }),
  ],
  ...over,
})

describe('timeline', () => {
  it('places each stage on the run’s clock, in the order they started, with its final status', () => {
    const t = timeline(trace())
    expect(t.total).toBe(200_000)
    expect(t.rows.map((r) => [r.stage, r.start, r.end, r.status])).toEqual([
      ['parse', 0, 4000, 'ok'],
      ['money', 10_000, 110_000, 'partial'],
      ['people', 10_000, 50_000, 'failed'],
    ])
    expect(t.rows[2]?.error).toBe('boom')
  })

  it('gives each stage its calls and its cost from the spend ledger', () => {
    const money = timeline(trace()).rows.find((r) => r.stage === 'money')
    expect(money?.calls).toHaveLength(3)
    expect(money).toMatchObject({ usd: 0.4, searches: 6 })
  })

  it('adds up what the guardrails did', () => {
    expect(timeline(trace()).totals).toEqual({ calls: 3, queries: 2, found: 12, cited: 5, retries: 1, removedCitations: 1, droppedClaims: 1, suspect: 1, capped: 1 })
  })

  it('runs a still-running stage to the last thing heard', () => {
    const t = timeline(trace({ run: { ...trace().run, finished_at: null, status: 'running' }, events: [{ stage: 'money', status: 'started', at: at(5), error: null }, { stage: 'parse', status: 'ok', at: at(30), error: null }] }))
    expect(t.rows.find((r) => r.stage === 'money')).toMatchObject({ status: 'running', end: 30_000 })
  })
})

describe('formatting', () => {
  it('reads durations the way people say them', () => {
    expect(duration(800)).toBe('0.8 s')
    expect(duration(38_400)).toBe('38 s')
    expect(duration(252_000)).toBe('4 min 12 s')
    expect(duration(120_000)).toBe('2 min')
  })
  it('names models plainly', () => {
    expect(modelName('claude-sonnet-5-5')).toBe('Sonnet 5.5')
    expect(modelName('claude-haiku-5-5')).toBe('Haiku 5.5')
    expect(modelName('something-else')).toBe('something-else')
  })
})
