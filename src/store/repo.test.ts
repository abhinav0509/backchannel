import { beforeEach, describe, expect, it } from 'vitest'
import { useTestDb, type Db } from '../db/db'
import { validReport, validTriage } from '../test/fixtures'
import { runBudget } from '../util/cost'
import * as repo from './repo'

const ME = '00000000-0000-0000-0000-00000000000a'
const OTHER = '00000000-0000-0000-0000-00000000000b'
let db: Db

beforeEach(async () => {
  db = await useTestDb()
})

describe('opportunities', () => {
  it('creates from pasted text and reads back the assembled shape', async () => {
    const o = await repo.createOpportunity(ME, '  Hi, a role at Example.  ')
    expect(o).toMatchObject({ text: 'Hi, a role at Example.', status: 'idle', company: null, report: null, triage: null, runs: [], events: [] })
    expect(o.id).toMatch(/^[a-z0-9]{16}$/)
    expect(await repo.getOpportunity(ME, o.id)).toEqual(o)
  })

  it('rejects empty text', async () => expect(repo.createOpportunity(ME, '  ')).rejects.toThrow(/empty/))

  it('never shows one owner another owner’s data', async () => {
    const o = await repo.createOpportunity(ME, 'mine')
    expect(await repo.getOpportunity(OTHER, o.id)).toBeNull()
    expect(await repo.listOpportunities(OTHER)).toEqual([])
    await expect(repo.patchOpportunity(OTHER, o.id, { company: 'x' })).rejects.toThrow(/no opportunity/)
  })

  it('lists newest first', async () => {
    const a = await repo.createOpportunity(ME, 'first')
    await db.query("update opportunities set created_at = now() - interval '1 hour' where id = $1", [a.id])
    const b = await repo.createOpportunity(ME, 'second')
    expect((await repo.listOpportunities(ME)).map((o) => o.id)).toEqual([b.id, a.id])
  })

  it('stores reports and triage results and validates them on the way in', async () => {
    const o = await repo.createOpportunity(ME, 'x')
    await repo.patchOpportunity(ME, o.id, { triage: validTriage(), report: validReport(), status: 'done' })
    const got = await repo.getOpportunity(ME, o.id)
    expect(got?.report?.identity.domain).toBe('example.com')
    await expect(repo.patchOpportunity(ME, o.id, { status: 'bogus' as never })).rejects.toThrow()
  })
})

describe('runs and events', () => {
  it('a run moves the opportunity to running, collects events in order and records its spend', async () => {
    const o = await repo.createOpportunity(ME, 'x')
    const runId = await repo.beginRun(ME, o.id, 'triage')
    await repo.recordEvent(ME, o.id, runId, { stage: 'parse', status: 'started', at: '2026-11-13T09:00:00.000Z' })
    await repo.recordEvent(ME, o.id, runId, { stage: 'parse', status: 'ok', at: '2026-11-13T09:00:01.000Z', output: { company_name: 'Example', role: { title: 'Designer' } } })
    const b = await runBudget('triage', runId)
    b.charge('resolve', 'claude-sonnet-5-5', { input: 1000, output: 100, cacheRead: 0, cacheWrite: 0, searches: 3 })
    await b.flush()

    const got = (await repo.getOpportunity(ME, o.id))!
    expect(got).toMatchObject({ status: 'running', company: 'Example', role: 'Designer' })
    expect(got.events.map((e) => `${e.stage}:${e.status}`)).toEqual(['parse:started', 'parse:ok'])
    expect(got.runs).toHaveLength(1)
    expect(got.runs[0]).toMatchObject({ id: runId, mode: 'triage', status: 'running', searches: 3, stages: { resolve: { searches: 3 } } })
    expect(got.runs[0]!.cost_usd).toBeGreaterThan(0)
  })

  it('shows events of the latest run only', async () => {
    const o = await repo.createOpportunity(ME, 'x')
    const r1 = await repo.beginRun(ME, o.id, 'triage')
    await repo.recordEvent(ME, o.id, r1, { stage: 'parse', status: 'ok', at: '2026-11-13T09:00:00.000Z' })
    await repo.finishRun(ME, o.id, r1, { status: 'done' })
    const r2 = await repo.beginRun(ME, o.id, 'deep')
    await repo.recordEvent(ME, o.id, r2, { stage: 'money', status: 'started', at: '2026-11-13T09:05:00.000Z' })
    const got = (await repo.getOpportunity(ME, o.id))!
    expect(got.events.map((e) => e.stage)).toEqual(['money'])
    expect(got.runs.map((r) => r.status)).toEqual(['done', 'running'])
  })

  it('finishing a run sets the outcome on both run and opportunity', async () => {
    const o = await repo.createOpportunity(ME, 'x')
    const r = await repo.beginRun(ME, o.id, 'deep')
    await repo.finishRun(ME, o.id, r, { status: 'failed', error: 'monthly cap of $20 reached' })
    const got = (await repo.getOpportunity(ME, o.id))!
    expect(got).toMatchObject({ status: 'failed', error: 'monthly cap of $20 reached' })
    expect(got.runs[0]).toMatchObject({ status: 'failed', error: 'monthly cap of $20 reached' })
    expect(got.runs[0]!.finished_at).not.toBeNull()
  })

  it('a run that has been running far too long is reported as stalled', async () => {
    const o = await repo.createOpportunity(ME, 'x')
    const r = await repo.beginRun(ME, o.id, 'deep')
    await db.query("update runs set started_at = now() - interval '2 hours' where id = $1", [r])
    expect(await repo.getOpportunity(ME, o.id)).toMatchObject({ status: 'failed', error: expect.stringMatching(/stalled/i) })
  })
})

describe('profiles', () => {
  it('returns null until saved, then the saved profile for that owner only', async () => {
    expect(await repo.getProfile(ME)).toBeNull()
    await repo.saveProfile(ME, { headline: 'Designer', years_experience: 8 })
    expect(await repo.getProfile(ME)).toMatchObject({ headline: 'Designer', years_experience: 8, skills: [] })
    expect(await repo.getProfile(OTHER)).toBeNull()
  })

  it('rejects an invalid profile', async () => expect(repo.saveProfile(ME, { years_experience: 'eight' })).rejects.toThrow())
})
