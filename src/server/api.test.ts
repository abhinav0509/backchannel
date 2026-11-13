import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../db/db'

const start = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({ runId: 'wrun_1' })))
vi.mock('workflow/api', () => ({ start }))
const repo = await import('../store/repo')
const { validReport, validTriage, ev } = await import('../test/fixtures')
const api = await import('./api')
type Summary = import('./api').Summary

const ME = '00000000-0000-0000-0000-00000000000a'
const OTHER = '00000000-0000-0000-0000-00000000000b'

beforeEach(async () => {
  await useTestDb()
  start.mockClear()
})

describe('create', () => {
  it('stores the text, opens a run and starts the durable workflow for it', async () => {
    const r = await api.create(ME, { text: 'A role at Example', mode: 'triage' })
    expect(r.status).toBe(201)
    const id = (r.body as { id: string }).id
    const o = (await repo.getOpportunity(ME, id))!
    expect(o.status).toBe('running')
    expect(start).toHaveBeenCalledWith(expect.any(Function), [{ owner: ME, oppId: id, runId: o.runs[0]!.id, mode: 'triage', text: 'A role at Example' }])
  })

  it.each([[{ text: '', mode: 'triage' }], [{ text: 'x', mode: 'turbo' }], [{ text: 'x'.repeat(60_001), mode: 'deep' }], ['not an object']])('rejects bad input %#', async (body) => {
    expect((await api.create(ME, body)).status).toBe(400)
    expect(start).not.toHaveBeenCalled()
  })

  it('marks the run failed if the workflow cannot be started', async () => {
    start.mockRejectedValueOnce(new Error('queue down'))
    const r = await api.create(ME, { text: 'x', mode: 'triage' })
    expect(r.status).toBe(502)
    const o = (await repo.listOpportunities(ME))[0]!
    expect(o).toMatchObject({ status: 'failed', error: expect.stringMatching(/queue down/) })
  })
})

describe('run', () => {
  it('starts a run, passing a chosen domain through', async () => {
    const o = await repo.createOpportunity(ME, 'x')
    expect((await api.run(ME, o.id, { mode: 'deep', companyDomain: 'example.com' })).status).toBe(202)
    expect(start.mock.calls[0]?.[1]).toEqual([expect.objectContaining({ mode: 'deep', companyDomain: 'example.com' })])
  })

  it('reuses the resolved domain for a deep run after a quick check', async () => {
    const o = await repo.createOpportunity(ME, 'x')
    await repo.patchOpportunity(ME, o.id, { domain: 'example.com' })
    await api.run(ME, o.id, { mode: 'deep' })
    expect(start.mock.calls[0]?.[1]).toEqual([expect.objectContaining({ companyDomain: 'example.com' })])
  })

  it('404s an unknown or someone else’s id, 409s while running, 400s a malformed domain', async () => {
    const o = await repo.createOpportunity(ME, 'x')
    expect((await api.run(OTHER, o.id, { mode: 'deep' })).status).toBe(404)
    expect((await api.run(ME, o.id, { mode: 'deep', companyDomain: 'https://x.com' })).status).toBe(400)
    await repo.beginRun(ME, o.id, 'triage')
    expect((await api.run(ME, o.id, { mode: 'deep' })).status).toBe(409)
  })
})

describe('get and list', () => {
  it('404s what the owner cannot see', async () => {
    const o = await repo.createOpportunity(ME, 'x')
    expect((await api.get(OTHER, o.id)).status).toBe(404)
    expect((await api.get(ME, o.id)).status).toBe(200)
  })

  it('summarises with score parts and top flags, never a blended score', async () => {
    const o = await repo.createOpportunity(ME, 'x')
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
    await repo.patchOpportunity(ME, o.id, { status: 'done', company: 'Example', role: 'Designer', report })
    const [s] = (await api.list(ME)).body as Summary[]
    expect(s).toMatchObject({ id: o.id, company: 'Example', headline: 'Main risk is ownership.', depth: 'deep' })
    expect(s!.flags.map((f) => f.title)).toEqual(['Layoffs', 'PE owned'])
    expect(s!.scores).toEqual([{ dimension: 'job_security', value: 30, unknown: false }, { dimension: 'comp_confidence', value: 0, unknown: true }])
    expect(s).not.toHaveProperty('score')
  })

  it('falls back to the triage recommendation, and shows the live stage while running', async () => {
    const a = await repo.createOpportunity(ME, 'x')
    await repo.patchOpportunity(ME, a.id, { status: 'done', triage: validTriage() })
    const b = await repo.createOpportunity(ME, 'y')
    const run = await repo.beginRun(ME, b.id, 'deep')
    await repo.recordEvent(ME, b.id, run, { stage: 'money', status: 'started', at: '2026-11-13T09:00:00.000Z' })
    const list = (await api.list(ME)).body as Summary[]
    expect(list.find((x) => x.id === a.id)).toMatchObject({ depth: 'triage', recommendation: 'deep', headline: 'Placeholder reason.' })
    expect(list.find((x) => x.id === b.id)).toMatchObject({ status: 'running', stage: 'money' })
  })
})

describe('markdown', () => {
  it('returns the deep report, else the triage, else 404', async () => {
    const o = await repo.createOpportunity(ME, 'x')
    expect((await api.markdown(ME, o.id)).status).toBe(404)
    await repo.patchOpportunity(ME, o.id, { triage: validTriage() })
    expect((await api.markdown(ME, o.id)).body).toMatch(/quick check/)
    await repo.patchOpportunity(ME, o.id, { report: validReport() })
    expect(await api.markdown(ME, o.id)).toMatchObject({ status: 200, filename: 'example-product-designer.md' })
    expect((await api.markdown(OTHER, o.id)).status).toBe(404)
  })
})

describe('profile', () => {
  it('reads null, saves a valid profile, rejects an invalid one', async () => {
    expect((await api.getProfile(ME)).body).toBeNull()
    expect((await api.saveProfile(ME, { headline: 'Designer', years_experience: 8 })).status).toBe(200)
    expect((await api.getProfile(ME)).body).toMatchObject({ headline: 'Designer' })
    expect((await api.saveProfile(ME, { headline: '', years_experience: -1 })).status).toBe(400)
  })
})
