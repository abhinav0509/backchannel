import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../db/db'
import { CompanyResearch, TriageResult } from '../types/research'

const m = vi.hoisted(() => ({ parse: vi.fn(), resolve: vi.fn(), business: vi.fn(), money: vi.fn(), people: vi.fn(), market: vi.fn(), synthesize: vi.fn(), triage: vi.fn() }))
vi.mock('../pipeline/stage0-parse', () => ({ parse: m.parse }))
vi.mock('../pipeline/stage1-resolve', async (orig) => ({ ...(await orig<typeof import('../pipeline/stage1-resolve')>()), resolve: m.resolve }))
vi.mock('../pipeline/stage2-business', () => ({ business: m.business }))
vi.mock('../pipeline/stage3-money', () => ({ money: m.money }))
vi.mock('../pipeline/stage4-people', () => ({ people: m.people }))
vi.mock('../pipeline/stage5-market', () => ({ market: m.market }))
vi.mock('../pipeline/stage8-synthesize', () => ({ synthesize: m.synthesize }))
vi.mock('../pipeline/stage-triage', () => ({ triage: m.triage }))

const repo = await import('../store/repo')
const { researchWorkflow } = await import('./research')
const { validReport } = await import('../test/fixtures')

const ME = '00000000-0000-0000-0000-00000000000a'
const r = validReport()
const parsed = { company_name: 'Example', domain_guess: null, role: r.role, recruiter: { name: null, email: null, agency: null }, comp_hint: null }
const resolved = { out: { candidates: [], identity: r.identity, gaps: ['no founding year'] }, dropped: [] }
const moneyOut = { ...r.money, gaps: ['no revenue'] }
const peopleOut = { ...r.people, gaps: [] }
const businessOut = { summary: null, products: [], customers: null, business_model: null, competitors: [], founders: [], leaders: [], gaps: [] }
const marketOut = { ai_stance: null, ai_summary: null, ai_initiatives: [], strategy: null, recent_news: [], tailwinds: [], headwinds: [], gaps: [] }
const synthOut = { flags: [], scores: [], questions: ['1', '2', '3', '4', '5', '6'].map((q) => ({ question: q, why: 'w', topic: 'role' })), verdict: 'Fine.', outlook: 'o', gaps: ['no comp'] }
const ok = <T>(data: T) => ({ data, dropped: [], searchCapped: false })

async function setup(mode: 'triage' | 'deep', companyDomain?: string) {
  const o = await repo.createOpportunity(ME, 'recruiter text')
  const runId = await repo.beginRun(ME, o.id, mode)
  return { owner: ME, oppId: o.id, runId, mode, text: o.text, ...(companyDomain && { companyDomain }) }
}

beforeEach(async () => {
  await useTestDb()
  Object.values(m).forEach((f) => f.mockReset())
  m.parse.mockResolvedValue(parsed)
  m.resolve.mockResolvedValue(resolved)
  m.money.mockResolvedValue(ok(moneyOut))
  m.people.mockResolvedValue(ok(peopleOut))
  m.business.mockResolvedValue(ok(businessOut))
  m.market.mockResolvedValue(ok(marketOut))
  m.synthesize.mockResolvedValue({ data: synthOut, dropped: [] })
  m.triage.mockResolvedValue(ok({ flags: [], deep_dive: { recommended: true, reason: 'layoffs' }, gaps: [] }))
})

describe('researchWorkflow', () => {
  it('runs a deep run end to end and stores a valid report with live events', async () => {
    const c = await setup('deep')
    await researchWorkflow(c)
    const o = (await repo.getOpportunity(ME, c.oppId))!
    expect(o).toMatchObject({ status: 'done', domain: 'example.com', company: 'Example' })
    expect(CompanyResearch.safeParse(o.report).success).toBe(true)
    expect(o.report!.gaps.slice(0, 2)).toEqual(['no comp', 'no founding year'])
    expect(o.events.map((e) => `${e.stage}:${e.status}`)).toEqual(expect.arrayContaining(['parse:ok', 'resolve:ok', 'business:ok', 'money:ok', 'people:ok', 'market:ok', 'synthesize:ok']))
    expect(o.runs[0]).toMatchObject({ status: 'done' })
  })

  it('a quick check stores a triage result', async () => {
    const c = await setup('triage')
    await researchWorkflow(c)
    const o = (await repo.getOpportunity(ME, c.oppId))!
    expect(TriageResult.safeParse(o.triage).success).toBe(true)
    expect(o.triage?.deep_dive.reason).toBe('layoffs')
    expect(m.money).not.toHaveBeenCalled()
  })

  it('stops for a choice when the company is ambiguous', async () => {
    m.resolve.mockResolvedValue({ out: { candidates: [{ name: 'A', domain: 'a.com', confidence: 0.3, reason: 'r' }], identity: null, gaps: [] }, dropped: [] })
    const c = await setup('deep')
    await researchWorkflow(c)
    expect(await repo.getOpportunity(ME, c.oppId)).toMatchObject({ status: 'needs_choice', candidates: [{ domain: 'a.com' }] })
    expect(m.money).not.toHaveBeenCalled()
  })

  it('a failed stage gives a partial report, not a failed run', async () => {
    m.people.mockRejectedValue(new Error('monthly cap of $20 reached'))
    const c = await setup('deep')
    await researchWorkflow(c)
    const o = (await repo.getOpportunity(ME, c.oppId))!
    expect(o.status).toBe('done')
    expect(o.report).toMatchObject({ partial: true, run: { stage_status: { people: 'failed' } } })
  })

  it('a failure before the company is known fails the run with the reason', async () => {
    m.parse.mockRejectedValue(new Error('invalid x-api-key'))
    const c = await setup('deep')
    await researchWorkflow(c)
    expect(await repo.getOpportunity(ME, c.oppId)).toMatchObject({ status: 'failed', error: expect.stringMatching(/x-api-key/) })
  })

  it('a chosen domain that research does not land on fails clearly', async () => {
    const c = await setup('deep', 'other.com')
    await researchWorkflow(c)
    expect(await repo.getOpportunity(ME, c.oppId)).toMatchObject({ status: 'failed', error: expect.stringMatching(/other\.com/) })
  })
})

describe('step retries', () => {
  it('rethrows transient API errors so the workflow retries the step, and settles everything else', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const { researchStep } = await import('./steps')
    const c = await setup('deep')
    m.money.mockRejectedValueOnce(new Anthropic.APIConnectionError({ message: 'socket hang up' }))
    await expect(researchStep(c, 'money', r.identity)).rejects.toThrow(/socket/)
    m.money.mockRejectedValueOnce(new Error('validation failed'))
    await expect(researchStep(c, 'money', r.identity)).resolves.toMatchObject({ data: null, error: 'validation failed' })
  })
})
