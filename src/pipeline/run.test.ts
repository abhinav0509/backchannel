import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Budget } from '../util/cost.js'
import { CompanyResearch, TriageResult } from '../types/research.js'
import type { RunEvent } from './run.js'

const m = vi.hoisted(() => ({
  parse: vi.fn(), resolve: vi.fn(), money: vi.fn(), people: vi.fn(), synthesize: vi.fn(), triage: vi.fn(),
}))
vi.mock('./stage0-parse.js', () => ({ parse: m.parse }))
vi.mock('./stage1-resolve.js', async (orig) => ({ ...(await orig<typeof import('./stage1-resolve.js')>()), resolve: m.resolve }))
vi.mock('./stage3-money.js', () => ({ money: m.money }))
vi.mock('./stage4-people.js', () => ({ people: m.people }))
vi.mock('./stage8-synthesize.js', () => ({ synthesize: m.synthesize }))
vi.mock('./stage-triage.js', () => ({ triage: m.triage }))
vi.mock('../util/cost.js', async (orig) => {
  const mod = await orig<typeof import('../util/cost.js')>()
  return { ...mod, runBudget: () => new mod.Budget({ searchesPerRun: 40, tokensPerRun: 1e6 }, { spentBefore: 0, capUsd: 20 }) }
})
const { runResearch } = await import('./run.js')

// Placeholder values only, not facts about a real company.
const ev = { url: 'https://a.example/1', title: 'T', publisher: null, published_at: null, retrieved_at: '2026-11-13T09:00:00Z', snippet: 's', trust_tier: 'secondary' }
const c = <T>(value: T) => ({ value, confidence: 'reported', evidence: [ev], as_of: null })
const identity = { legal_name: c('Example Corp'), display_name: 'Example', domain: 'example.com', hq: c('Nowhere'), founded_year: null, is_public: c(false), resolution_confidence: 0.9 }
const role = { title: 'Designer', level_claimed: null, location: null, work_policy: 'unknown', employment_type: 'unknown', required_years: null, extracted_requirements: [] }
const parsed = { company_name: 'Example', domain_guess: null, role, recruiter: { name: null, email: null, agency: null }, comp_hint: null }
const moneyOut = { ownership_type: c('vc_backed'), funding_events: [], revenue_signal: null, profitability: null, exit_activity: [], gaps: ['no revenue'] }
const peopleOut = { headcount: null, headcount_trend: null, layoff_events: [], leadership_changes: [], review_scores: [], gaps: ['no reviews'] }
const synthOut = { flags: [], scores: [], questions_to_ask: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'], verdict: 'Fine.', gaps: ['no reviews', 'no comp'] }

const ok = <T>(data: T, extra = {}) => ({ data, dropped: [], searchCapped: false, ...extra })

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset())
  m.parse.mockResolvedValue(parsed)
  m.resolve.mockResolvedValue({ out: { candidates: [], identity, gaps: [] }, dropped: [] })
  m.money.mockResolvedValue(ok(moneyOut))
  m.people.mockResolvedValue(ok(peopleOut))
  m.synthesize.mockResolvedValue({ data: synthOut, dropped: [] })
  m.triage.mockResolvedValue(ok({ flags: [], deep_dive: { recommended: true, reason: 'layoffs' }, gaps: ['thin'] }))
})

describe('deep run', () => {
  it('produces a valid complete report with merged, de-duplicated gaps', async () => {
    const o = await runResearch({ text: 't', mode: 'deep', profile: null })
    if (o.kind !== 'report') throw new Error(o.kind)
    expect(CompanyResearch.safeParse(o.report).success).toBe(true)
    expect(o.report.partial).toBe(false)
    expect(o.report.run.stage_status).toEqual({ parse: 'ok', resolve: 'ok', money: 'ok', people: 'ok', synthesize: 'ok' })
    expect(o.report.money.ownership_type?.value).toBe('vc_backed')
    expect(o.report.gaps).toEqual(['no revenue', 'no reviews', 'no comp'])
  })

  it('runs money and people in parallel', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    m.money.mockImplementation(async () => (await gate, ok(moneyOut)))
    m.people.mockImplementation(async () => (release(), ok(peopleOut)))
    const o = await runResearch({ text: 't', mode: 'deep', profile: null })
    expect(o.kind).toBe('report')
  })

  it('a failed stage degrades the report instead of killing it', async () => {
    m.money.mockRejectedValue(new Error('boom'))
    m.people.mockResolvedValue(ok(peopleOut, { searchCapped: true }))
    const o = await runResearch({ text: 't', mode: 'deep', profile: null })
    if (o.kind !== 'report') throw new Error(o.kind)
    expect(CompanyResearch.safeParse(o.report).success).toBe(true)
    expect(o.report.partial).toBe(true)
    expect(o.report.run.stage_status).toMatchObject({ money: 'failed', people: 'partial', synthesize: 'ok' })
    expect(o.report.money.ownership_type).toBeNull()
    expect(o.report.gaps.some((g) => /money.*boom/i.test(g))).toBe(true)
    expect(o.report.gaps.some((g) => /people.*search limit/i.test(g))).toBe(true)
  })

  it('a failed synthesis still returns the sourced research', async () => {
    m.synthesize.mockRejectedValue(new Error('invalid'))
    const o = await runResearch({ text: 't', mode: 'deep', profile: null })
    if (o.kind !== 'report') throw new Error(o.kind)
    expect(CompanyResearch.safeParse(o.report).success).toBe(true)
    expect(o.report).toMatchObject({ partial: true, flags: [], scores: [], questions_to_ask: [] })
    expect(o.report.verdict).toMatch(/synthesis did not complete/i)
  })

  it('records dropped claims as gaps', async () => {
    m.money.mockResolvedValue({ ...ok(moneyOut), dropped: ['dropped an unsourced claim at revenue_signal'] })
    const o = await runResearch({ text: 't', mode: 'deep', profile: null })
    if (o.kind !== 'report') throw new Error(o.kind)
    expect(o.report.gaps).toContain('dropped an unsourced claim at revenue_signal')
  })

  it('emits stage events in order, with outputs, for live progress', async () => {
    const events: RunEvent[] = []
    await runResearch({ text: 't', mode: 'deep', profile: null, onEvent: (e) => events.push(e) })
    const seq = events.map((e) => `${e.stage}:${e.status}`)
    expect(seq.slice(0, 4)).toEqual(['parse:started', 'parse:ok', 'resolve:started', 'resolve:ok'])
    expect(seq).toContain('money:ok')
    expect(seq.at(-1)).toBe('synthesize:ok')
    expect(events.find((e) => e.stage === 'money' && e.status === 'ok')?.output).toMatchObject({ ownership_type: { value: 'vc_backed' } })
  })

  it('passes the profile to synthesis', async () => {
    const profile = { headline: 'h' } as never
    await runResearch({ text: 't', mode: 'deep', profile })
    expect(m.synthesize.mock.calls[0]?.[0].profile).toBe(profile)
  })
})

describe('the gate', () => {
  it('stops before any research when resolution is unsure', async () => {
    m.resolve.mockResolvedValue({ out: { candidates: [{ name: 'A', domain: 'a.com', confidence: 0.4, reason: 'r' }], identity: null, gaps: ['g'] }, dropped: [] })
    const o = await runResearch({ text: 't', mode: 'deep', profile: null })
    expect(o).toMatchObject({ kind: 'needs_choice', candidates: [{ domain: 'a.com' }], gaps: ['g'] })
    expect(m.money).not.toHaveBeenCalled()
  })
})

describe('triage run', () => {
  it('runs parse, resolve and the quick pass only', async () => {
    const o = await runResearch({ text: 't', mode: 'triage', profile: null })
    if (o.kind !== 'triage') throw new Error(o.kind)
    expect(TriageResult.safeParse(o.result).success).toBe(true)
    expect(o.result.deep_dive).toEqual({ recommended: true, reason: 'layoffs' })
    expect(o.result.run.mode).toBe('triage')
    expect(m.money).not.toHaveBeenCalled()
    expect(m.synthesize).not.toHaveBeenCalled()
  })
})

it('budget accounting lands in the report', async () => {
  const o = await runResearch({ text: 't', mode: 'deep', profile: null })
  if (o.kind !== 'report') throw new Error(o.kind)
  expect(o.budget).toBeInstanceOf(Budget)
  expect(o.report.run).toMatchObject({ searches_used: 0, cost_usd: 0, mode: 'deep' })
})
