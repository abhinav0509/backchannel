import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../db/db'
import { Budget } from '../util/cost'
import type { RunEvent } from '../types/research'

const runResearch = vi.hoisted(() => vi.fn())
vi.mock('../pipeline/run', async (orig) => ({ ...(await orig<typeof import('../pipeline/run')>()), runResearch }))
vi.mock('../types/profile', async (orig) => ({ ...(await orig<typeof import('../types/profile')>()), loadProfile: () => null }))
const repo = await import('./repo')
const { runInProcess } = await import('./runner')
const { validReport, validTriage } = await import('../test/fixtures')

const ME = '00000000-0000-0000-0000-00000000000a'
const budget = () => new Budget({ searchesPerRun: 40, tokensPerRun: 1e6 }, { spentBefore: 0, capUsd: 20 })
const at = '2026-11-13T09:00:00.000Z'

beforeEach(async () => {
  await useTestDb()
  runResearch.mockReset()
})

describe('runInProcess (CLI)', () => {
  it('records events and the triage result, and passes the run id so spend is attributed', async () => {
    runResearch.mockImplementation(async ({ onEvent }: { onEvent: (e: RunEvent) => Promise<void> }) => {
      await onEvent({ stage: 'parse', status: 'ok', at, output: { company_name: 'Example', role: { title: 'Designer' } } })
      return { kind: 'triage', result: validTriage(), budget: budget() }
    })
    const o = await repo.createOpportunity(ME, 'text')
    await runInProcess(ME, o.id, { mode: 'triage' })
    const got = (await repo.getOpportunity(ME, o.id))!
    expect(got).toMatchObject({ status: 'done', role: 'Designer', domain: 'example.com' })
    expect(got.triage).not.toBeNull()
    expect(runResearch.mock.calls[0]?.[0].runId).toBe(got.runs[0]?.id)
  })

  it('a later deep run reuses the resolved domain and keeps the triage', async () => {
    runResearch.mockResolvedValueOnce({ kind: 'triage', result: validTriage({ name: 'E', domain: 'e.com' }), budget: budget() })
    runResearch.mockResolvedValueOnce({ kind: 'report', report: validReport({ name: 'E', domain: 'e.com' }), budget: budget() })
    const o = await repo.createOpportunity(ME, 'text')
    await runInProcess(ME, o.id, { mode: 'triage' })
    await runInProcess(ME, o.id, { mode: 'deep' })
    expect(runResearch.mock.calls[1]?.[0]).toMatchObject({ mode: 'deep', companyDomain: 'e.com' })
    const got = (await repo.getOpportunity(ME, o.id))!
    expect(got.triage && got.report).toBeTruthy()
  })

  it('pauses for a choice, and records failures with their message', async () => {
    runResearch.mockResolvedValueOnce({ kind: 'needs_choice', reason: 'low', candidates: [{ name: 'A', domain: 'a.com', confidence: 0.4, reason: 'r' }], gaps: [], budget: budget() })
    const o = await repo.createOpportunity(ME, 'text')
    await runInProcess(ME, o.id, { mode: 'triage' })
    expect(await repo.getOpportunity(ME, o.id)).toMatchObject({ status: 'needs_choice', choice_reason: 'low' })
    runResearch.mockRejectedValueOnce(new Error('monthly cap of $20 reached'))
    await runInProcess(ME, o.id, { mode: 'triage', companyDomain: 'a.com' })
    expect(await repo.getOpportunity(ME, o.id)).toMatchObject({ status: 'failed', error: 'monthly cap of $20 reached' })
  })
})
