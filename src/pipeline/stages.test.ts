import { describe, expect, it, vi } from 'vitest'
import { Budget } from '../util/cost.js'
import type { CompanyResearch } from '../types/research.js'

const researchStage = vi.hoisted(() => vi.fn(async () => ({ data: { gaps: [] }, dropped: [], searchCapped: false })))
const callStructured = vi.hoisted(() => vi.fn(async () => ({ data: { flags: [], scores: [], questions_to_ask: [], verdict: 'v', gaps: [] }, dropped: [] })))
vi.mock('./shared.js', async (orig) => ({ ...(await orig<typeof import('./shared.js')>()), researchStage }))
vi.mock('../llm/call.js', () => ({ callStructured, callResearch: vi.fn() }))

const { money, MoneyOut } = await import('./stage3-money.js')
const { people, PeopleOut } = await import('./stage4-people.js')
const { synthesize, SynthOut } = await import('./stage8-synthesize.js')
const { triage, TriageOut } = await import('./stage-triage.js')

const budget = () => new Budget({ searchesPerRun: 40, tokensPerRun: 1e6 }, { spentBefore: 0, capUsd: 20 })
const company = { display_name: 'Example', domain: 'example.com' }
const lastArgs = () => (researchStage.mock.calls.at(-1) as unknown as [Record<string, unknown>])[0]

describe('research stages anchor every search on the resolved domain', () => {
  it.each([
    ['money', () => money(company, budget()), 8, MoneyOut],
    ['people', () => people(company, budget()), 10, PeopleOut],
    ['triage', () => triage(company, budget()), 4, TriageOut],
  ] as const)('%s', async (stage, run, maxSearches, schema) => {
    await run()
    const a = lastArgs()
    expect(a).toMatchObject({ stage, maxSearches, schema })
    expect(a.prompt).toContain('example.com')
    expect(a.prompt).toMatch(/similar name/i)
  })
})

describe('stage output schemas', () => {
  it('money and people carry gaps', () => {
    expect(MoneyOut.safeParse({ ownership_type: null, funding_events: [], revenue_signal: null, profitability: null, exit_activity: [], gaps: [] }).success).toBe(true)
    expect(PeopleOut.safeParse({ headcount: null, headcount_trend: null, layoff_events: [], leadership_changes: [], review_scores: [] }).success).toBe(false)
  })

  const score = (dimension: string) => ({ dimension, value: 50, rationale: 'r', evidence_urls: [], unknown: false })
  const six = ['role_fit', 'company_health', 'job_security', 'career_signal', 'culture', 'comp_confidence'].map(score)
  const synth = (o: object = {}) => ({ flags: [], scores: six, questions_to_ask: ['1', '2', '3', '4', '5', '6'], verdict: 'v', gaps: [], ...o })

  it('synthesis needs all six scores exactly once and 6 to 10 questions', () => {
    expect(SynthOut.safeParse(synth()).success).toBe(true)
    expect(SynthOut.safeParse(synth({ scores: six.slice(0, 5) })).success).toBe(false)
    expect(SynthOut.safeParse(synth({ scores: [...six.slice(0, 5), score('role_fit')] })).success).toBe(false)
    expect(SynthOut.safeParse(synth({ questions_to_ask: ['1'] })).success).toBe(false)
  })

  it('triage recommends whether to go deep, with a reason', () => {
    expect(TriageOut.safeParse({ flags: [], deep_dive: { recommended: true, reason: 'r' }, gaps: [] }).success).toBe(true)
  })
})

describe('synthesize', () => {
  it('only lets flags and scores cite evidence already in the report, and passes the profile', async () => {
    const draft = { identity: { hq: { evidence: [{ url: 'https://a.example/1' }] } }, money: {}, people: {} } as unknown as Omit<CompanyResearch, 'flags'>
    await synthesize({ draft, profile: { headline: 'Designer' } as never }, budget())
    const a = (callStructured.mock.calls.at(-1) as unknown as [Record<string, unknown>])[0]
    expect(a).toMatchObject({ stage: 'synthesize', model: 'claude-opus-5-5', schema: SynthOut, retrievedUrls: ['https://a.example/1'] })
    expect(a.prompt).toContain('Designer')
  })

  it('without a profile, says role fit cannot be judged', async () => {
    await synthesize({ draft: {} as never, profile: null }, budget())
    const a = (callStructured.mock.calls.at(-1) as unknown as [Record<string, unknown>])[0]
    expect(a.prompt).toMatch(/no candidate profile/i)
  })
})

describe('large schemas', () => {
  it('money and people extract without constrained decoding', async () => {
    await money(company, budget())
    expect(lastArgs()).toMatchObject({ constrained: false })
    await people(company, budget())
    expect(lastArgs()).toMatchObject({ constrained: false })
  })
})

describe('synthPrompt', () => {
  it('leaves out run bookkeeping, so equal research gives an equal prompt (and a cache hit)', async () => {
    const { synthPrompt } = await import('./stage8-synthesize.js')
    const { validReport } = await import('../test/fixtures.js')
    const { flags: _f, scores: _s, questions_to_ask: _q, verdict: _v, ...draft } = validReport()
    const a = synthPrompt(draft, null)
    const b = synthPrompt({ ...draft, generated_at: '2030-01-01T00:00:00.000Z', run: { ...draft.run, duration_ms: 99, cost_usd: 9 } }, null)
    expect(a).toBe(b)
    expect(a).not.toContain('duration_ms')
    expect(a).toContain('Example Inc.')
  })
})

it('triage asks for a recommendation addressed to the candidate', async () => {
  const { triageTask } = await import('./stage-triage.js')
  expect(triageTask).toMatch(/addressed to the candidate/i)
})
