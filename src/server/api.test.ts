import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const startRun = vi.hoisted(() => vi.fn(async () => {}))
const isActive = vi.hoisted(() => vi.fn((_id: string) => false))
vi.mock('../store/runner.js', async (orig) => ({ ...(await orig<typeof import('../store/runner.js')>()), startRun, isActive }))
const { createOpportunity, updateOpportunity } = await import('../store/store.js')
const { validReport, validTriage, ev } = await import('../test/fixtures.js')
const api = await import('./api.js')
type Summary = import('./api.js').Summary

beforeEach(() => {
  process.env.BACKCHANNEL_DATA_DIR = mkdtempSync(join(tmpdir(), 'bc-api-'))
  startRun.mockClear()
  isActive.mockReturnValue(false)
})

describe('create', () => {
  it('stores the text and starts a run in the requested mode', async () => {
    const r = await api.create({ text: 'A role at Example', mode: 'triage' })
    expect(r.status).toBe(201)
    const id = (r.body as { id: string }).id
    expect(startRun).toHaveBeenCalledWith(id, { mode: 'triage' })
  })

  it.each([
    [{ text: '', mode: 'triage' }],
    [{ text: 'x', mode: 'turbo' }],
    [{ text: 'x'.repeat(60_001), mode: 'deep' }],
    ['not an object'],
  ])('rejects bad input %#', async (body) => {
    const r = await api.create(body)
    expect(r.status).toBe(400)
    expect(startRun).not.toHaveBeenCalled()
  })
})

describe('run', () => {
  it('starts a run, passing a chosen domain through', async () => {
    const o = createOpportunity('x')
    const r = await api.run(o.id, { mode: 'deep', companyDomain: 'example.com' })
    expect(r.status).toBe(202)
    expect(startRun).toHaveBeenCalledWith(o.id, { mode: 'deep', companyDomain: 'example.com' })
  })

  it('404s an unknown id, 409s while running, 400s a malformed domain', async () => {
    expect((await api.run('unknownid0', { mode: 'deep' })).status).toBe(404)
    const o = createOpportunity('x')
    expect((await api.run(o.id, { mode: 'deep', companyDomain: 'https://x.com' })).status).toBe(400)
    isActive.mockReturnValue(true)
    expect((await api.run(o.id, { mode: 'deep' })).status).toBe(409)
  })
})

describe('get', () => {
  it('404s unknown, and reports a run cut off by a restart as interrupted', () => {
    expect(api.get('unknownid0').status).toBe(404)
    const o = createOpportunity('x')
    updateOpportunity(o.id, (d) => ({ ...d, status: 'running' }))
    expect(api.get(o.id).body).toMatchObject({ status: 'failed', error: expect.stringMatching(/interrupted/) })
  })
})

describe('list summaries', () => {
  it('summarises a researched opportunity with its score parts and top flags, never a blended score', () => {
    const o = createOpportunity('x')
    const report = validReport()
    report.verdict = 'Main risk is ownership. More detail follows.'
    report.scores = [
      { dimension: 'job_security', value: 30, rationale: 'r', evidence_urls: [], unknown: false },
      { dimension: 'comp_confidence', value: 0, rationale: 'r', evidence_urls: [], unknown: true },
    ]
    report.flags = [
      { kind: 'profitable', polarity: 'green', severity: 3, title: 'Profitable', detail: 'd', basis: 'web', evidence: [ev()] },
      { kind: 'pe_ownership', polarity: 'risk', severity: 4, title: 'PE owned', detail: 'd', basis: 'web', evidence: [ev()] },
      { kind: 'layoff_history', polarity: 'risk', severity: 5, title: 'Layoffs', detail: 'd', basis: 'web', evidence: [ev()] },
    ]
    updateOpportunity(o.id, (d) => ({ ...d, status: 'done', company: 'Example', role: 'Designer', report, runs: [] }))
    const [s] = api.list().body as Summary[]
    expect(s).toMatchObject({ id: o.id, company: 'Example', headline: 'Main risk is ownership.', depth: 'deep' })
    expect(s!.flags.map((f) => f.title)).toEqual(['Layoffs', 'PE owned'])
    expect(s!.scores).toEqual([{ dimension: 'job_security', value: 30, unknown: false }, { dimension: 'comp_confidence', value: 0, unknown: true }])
    expect(s).not.toHaveProperty('score')
  })

  it('falls back to the triage recommendation, and shows the live stage while running', () => {
    const a = createOpportunity('x')
    updateOpportunity(a.id, (d) => ({ ...d, status: 'done', triage: validTriage() }))
    const b = createOpportunity('y')
    updateOpportunity(b.id, (d) => ({ ...d, status: 'running', events: [{ stage: 'money', status: 'started', at: '2026-11-13T09:00:00.000Z' }] }))
    isActive.mockImplementation((id: string) => id === b.id)
    const [rb, ra] = api.list().body as Summary[]
    expect(ra).toMatchObject({ depth: 'triage', recommendation: 'deep', headline: 'Placeholder reason.' })
    expect(rb).toMatchObject({ status: 'running', stage: 'money' })
  })

  it('totals the cost across runs', () => {
    const o = createOpportunity('x')
    const run = { id: 'r', mode: 'triage' as const, started_at: '2026-11-13T09:00:00.000Z', finished_at: null, status: 'done' as const, cost_usd: 0.2, searches: 1, input_tokens: 1, output_tokens: 1, stages: {}, error: null }
    updateOpportunity(o.id, (d) => ({ ...d, runs: [run, { ...run, id: 's', cost_usd: 1.05 }] }))
    expect((api.list().body as Summary[])[0]?.cost_usd).toBeCloseTo(1.25)
  })
})
