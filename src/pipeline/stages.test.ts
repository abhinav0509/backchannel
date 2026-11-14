import { describe, expect, it, vi } from 'vitest'
import { Budget } from '../util/cost'
import type { CompanyResearch } from '../types/research'

const researchStage = vi.hoisted(() => vi.fn(async () => ({ data: { gaps: [] }, dropped: [], searchCapped: false })))
const callStructured = vi.hoisted(() => vi.fn(async () => ({ data: { flags: [], scores: [], questions_to_ask: [], verdict: 'v', gaps: [] }, dropped: [] })))
vi.mock('./shared', async (orig) => ({ ...(await orig<typeof import('./shared')>()), researchStage }))
vi.mock('../llm/call', () => ({ callStructured, callResearch: vi.fn() }))

const { money, MoneyOut } = await import('./stage3-money')
const { people, PeopleOut } = await import('./stage4-people')
const { business, BusinessOut } = await import('./stage2-business')
const { market, MarketOut } = await import('./stage5-market')
const { synthesize, SynthOut } = await import('./stage8-synthesize')
const { triage, TriageOut } = await import('./stage-triage')

const budget = () => new Budget({ searchesPerRun: 40, tokensPerRun: 1e6 }, { spentBefore: 0, capUsd: 20 })
const company = { display_name: 'Example', domain: 'example.com' }
const lastArgs = () => (researchStage.mock.calls.at(-1) as unknown as [Record<string, unknown>])[0]

describe('research stages anchor every search on the resolved domain', () => {
  it.each([
    ['money', () => money(company, budget()), 8, MoneyOut],
    ['people', () => people(company, budget()), 10, PeopleOut],
    ['triage', () => triage(company, budget()), 4, TriageOut],
    ['business', () => business(company, budget()), 6, BusinessOut],
    ['market', () => market(company, budget()), 6, MarketOut],
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
  const q = (n: number) => Array.from({ length: n }, (_, i) => ({ question: `q${i}`, why: 'w', topic: 'role' }))
  const synth = (o: object = {}) => ({ flags: [], scores: six, questions: q(6), verdict: 'v', outlook: 'o', gaps: [], ...o })

  it('synthesis needs all six scores exactly once and 6 to 12 questions, each with why and topic', () => {
    expect(SynthOut.safeParse(synth()).success).toBe(true)
    expect(SynthOut.safeParse(synth({ scores: six.slice(0, 5) })).success).toBe(false)
    expect(SynthOut.safeParse(synth({ scores: [...six.slice(0, 5), score('role_fit')] })).success).toBe(false)
    expect(SynthOut.safeParse(synth({ questions: q(5) })).success).toBe(false)
    expect(SynthOut.safeParse(synth({ questions: q(13) })).success).toBe(false)
    expect(SynthOut.safeParse(synth({ questions: [{ question: 'x', topic: 'role' }, ...q(5)] })).success).toBe(false)
  })

  it('business and market carry gaps, and the AI stance is a fixed scale', () => {
    const empty = { summary: null, products: [], customers: null, business_model: null, competitors: [], founders: [], leaders: [] }
    expect(BusinessOut.safeParse({ ...empty, gaps: [] }).success).toBe(true)
    expect(BusinessOut.safeParse(empty).success).toBe(false)
    const m = { ai_stance: null, ai_summary: null, ai_initiatives: [], strategy: null, recent_news: [], tailwinds: [], headwinds: [], gaps: [] }
    expect(MarketOut.safeParse(m).success).toBe(true)
    const stance = (value: string) => ({ ...m, ai_stance: { value, confidence: 'reported', as_of: null, evidence: [{ url: 'https://a.example/1', title: 't', publisher: null, published_at: null, retrieved_at: '2026-11-13T00:00:00.000Z', snippet: 's', trust_tier: 'secondary' }] } })
    expect(MarketOut.safeParse(stance('ai_core')).success).toBe(true)
    expect(MarketOut.safeParse(stance('very ai')).success).toBe(false)
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
  it('claim-heavy stages extract without constrained decoding', async () => {
    for (const run of [money, people, business, market]) {
      await run(company, budget())
      expect(lastArgs()).toMatchObject({ constrained: false })
    }
  })
})

describe('synthPrompt', () => {
  it('leaves out run bookkeeping, so equal research gives an equal prompt (and a cache hit)', async () => {
    const { synthPrompt } = await import('./stage8-synthesize')
    const { validReport } = await import('../test/fixtures')
    const { flags: _f, scores: _s, questions_to_ask: _q, questions: _qs, verdict: _v, outlook: _o, ...draft } = validReport()
    const a = synthPrompt(draft, null)
    const b = synthPrompt({ ...draft, generated_at: '2030-01-01T00:00:00.000Z', run: { ...draft.run, duration_ms: 99, cost_usd: 9 } }, null)
    expect(a).toBe(b)
    expect(a).not.toContain('duration_ms')
    expect(a).toContain('Example Inc.')
  })
})

it('synthesis reads the business and market research, and labels the outlook as a read', async () => {
  const { synthPrompt, synthTask } = await import('./stage8-synthesize')
  const { validReport } = await import('../test/fixtures')
  const { flags: _f, scores: _s, questions_to_ask: _q, questions: _qs, verdict: _v, outlook: _o, ...draft } = validReport()
  const p = synthPrompt({ ...draft, business: { summary: null, products: [], customers: null, business_model: null, competitors: [], founders: [], leaders: [] }, market: null }, null)
  expect(p).toContain('"business"')
  expect(p).toContain('"market"')
  expect(synthTask).toMatch(/outlook/i)
  expect(synthTask).toMatch(/why/i)
})

it('business and market cap their lists, so extraction fits in one answer', async () => {
  const { businessTask } = await import('./stage2-business')
  const { marketTask } = await import('./stage5-market')
  for (const task of [businessTask, marketTask]) {
    expect(task).toMatch(/at most \d+/)
    expect(task).toMatch(/one evidence entry/)
  }
  expect(businessTask).toMatch(/company name alone/)
})

it('triage asks for a recommendation addressed to the candidate', async () => {
  const { triageTask } = await import('./stage-triage')
  expect(triageTask).toMatch(/addressed to the candidate/i)
})

it('money extraction demands full units and a currency for any amount', async () => {
  const { moneyTask } = await import('./stage3-money')
  expect(moneyTask).toMatch(/full units/i)
  expect(moneyTask).toContain('30000000')
  expect(moneyTask).toMatch(/no currency.*null/i)
})
