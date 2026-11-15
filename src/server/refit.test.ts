import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../db/db'

const synthesize = vi.hoisted(() => vi.fn())
vi.mock('../pipeline/stage8-synthesize', () => ({ synthesize }))
const repo = await import('../store/repo')
const { validReport } = await import('../test/fixtures')
const { refit } = await import('./refit')

const ME = '00000000-0000-0000-0000-00000000000a'
const profile = { headline: 'Designer', years_experience: 6, current_level: null, target_levels: [], skills: [], domains_of_interest: [], locations: [], work_policy: 'any', constraints: [], projects: [] }
const out = {
  flags: [],
  scores: [],
  questions: [{ question: 'New q?', why: 'w', topic: 'role' }],
  verdict: 'New verdict.',
  outlook: 'New outlook.',
  fit: { summary: 'Good fit.', strengths: ['s'], gaps: [], talking_points: ['t'] },
  gaps: ['new gap'],
}

async function researched() {
  const o = await repo.createOpportunity(ME, 'x')
  const run = await repo.beginRun(ME, o.id, 'deep')
  const report = { ...validReport(), verdict: 'Old verdict.', gaps: ['old gap'] }
  await repo.finishRun(ME, o.id, run, { status: 'done', report })
  return { o, run }
}

beforeEach(async () => {
  await useTestDb()
  synthesize.mockReset()
  synthesize.mockResolvedValue({ data: out, dropped: [] })
})

describe('refit', () => {
  it('re-judges the stored research against the profile, keeping the research itself', async () => {
    const { o } = await researched()
    await repo.saveProfile(ME, profile)
    const r = await refit(ME, o.id)
    expect(r.status).toBe(200)
    const got = (await repo.getOpportunity(ME, o.id))!.report!
    expect(got).toMatchObject({ verdict: 'New verdict.', outlook: 'New outlook.', fit: { summary: 'Good fit.' }, questions_to_ask: ['New q?'] })
    expect(got.identity.domain).toBe('example.com')
    expect(got.gaps).toEqual(['new gap', 'old gap'])
    const input = synthesize.mock.calls[0]![0]
    expect(input.profile).toMatchObject({ headline: 'Designer' })
    expect(input.draft).not.toHaveProperty('verdict')
  })

  it('needs a full report and a profile, and refuses while research runs', async () => {
    const bare = await repo.createOpportunity(ME, 'x')
    await repo.saveProfile(ME, profile)
    expect((await refit(ME, bare.id)).status).toBe(409)
    const { o } = await researched()
    await repo.beginRun(ME, o.id, 'triage')
    expect((await refit(ME, o.id)).status).toBe(409)
    expect((await refit('00000000-0000-0000-0000-00000000000b', o.id)).status).toBe(404)
  })

  it('without a profile, says to add a CV', async () => {
    const { o } = await researched()
    const r = await refit(ME, o.id)
    expect(r).toMatchObject({ status: 409, body: { error: expect.stringMatching(/CV/) } })
    expect(synthesize).not.toHaveBeenCalled()
  })

  it('leaves the report alone when the judgement fails', async () => {
    const { o } = await researched()
    await repo.saveProfile(ME, profile)
    synthesize.mockRejectedValue(new Error('overloaded'))
    expect((await refit(ME, o.id)).status).toBe(502)
    expect((await repo.getOpportunity(ME, o.id))!.report!.verdict).toBe('Old verdict.')
  })
})
