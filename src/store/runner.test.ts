import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Budget } from '../util/cost.js'
import type { RunEvent } from '../types/research.js'

const runResearch = vi.hoisted(() => vi.fn())
vi.mock('../pipeline/run.js', () => ({ runResearch }))
vi.mock('../types/profile.js', () => ({ loadProfile: () => null }))
const { createOpportunity, getOpportunity } = await import('./store.js')
const { validReport, validTriage } = await import('../test/fixtures.js')
const { startRun, isActive, reconcile } = await import('./runner.js')

const budget = () => {
  const b = new Budget({ searchesPerRun: 40, tokensPerRun: 1e6 }, { spentBefore: 0, capUsd: 20 })
  b.charge('resolve', 'claude-sonnet-5-5', { input: 1000, output: 100, cacheRead: 0, cacheWrite: 0, searches: 3 })
  return b
}
const at = '2026-11-13T09:00:00.000Z'

beforeEach(() => {
  process.env.BACKCHANNEL_DATA_DIR = mkdtempSync(join(tmpdir(), 'bc-run-'))
  runResearch.mockReset()
})

describe('startRun', () => {
  it('streams events into the opportunity, fills company and role from parse, and records the run', async () => {
    const triage = validTriage()
    runResearch.mockImplementation(async ({ onEvent }: { onEvent: (e: RunEvent) => void }) => {
      onEvent({ stage: 'parse', status: 'started', at })
      onEvent({ stage: 'parse', status: 'ok', at, output: { company_name: 'Example', role: { title: 'Designer' } } })
      return { kind: 'triage', result: triage, budget: budget() }
    })
    const o = createOpportunity('text')
    const p = startRun(o.id, { mode: 'triage' })
    expect(getOpportunity(o.id)?.status).toBe('running')
    expect(isActive(o.id)).toBe(true)
    await p
    const done = getOpportunity(o.id)!
    expect(done).toMatchObject({ status: 'done', company: 'Example', role: 'Designer', domain: 'example.com', triage })
    expect(done.events.map((e) => `${e.stage}:${e.status}`)).toEqual(['parse:started', 'parse:ok'])
    expect(done.runs).toHaveLength(1)
    expect(done.runs[0]).toMatchObject({ mode: 'triage', status: 'done', searches: 3 })
    expect(done.runs[0]!.cost_usd).toBeGreaterThan(0)
    expect(isActive(o.id)).toBe(false)
  })

  it('a deep run keeps the earlier triage and stores the report', async () => {
    runResearch.mockResolvedValueOnce({ kind: 'triage', result: validTriage({ name: 'E', domain: 'e.com' }), budget: budget() })
    runResearch.mockResolvedValueOnce({ kind: 'report', report: validReport({ name: 'E', domain: 'e.com' }), budget: budget() })
    const o = createOpportunity('text')
    await startRun(o.id, { mode: 'triage' })
    await startRun(o.id, { mode: 'deep' })
    const d = getOpportunity(o.id)!
    expect(d.triage).not.toBeNull()
    expect(d.report).not.toBeNull()
    expect(d.runs.map((r) => r.mode)).toEqual(['triage', 'deep'])
    expect(runResearch.mock.calls[1]?.[0]).toMatchObject({ mode: 'deep', companyDomain: 'e.com' })
  })

  it('pauses for a choice when the gate fires, then continues with the chosen domain', async () => {
    runResearch.mockResolvedValueOnce({ kind: 'needs_choice', reason: 'low', candidates: [{ name: 'A', domain: 'a.com', confidence: 0.4, reason: 'r' }], gaps: [], budget: budget() })
    const o = createOpportunity('text')
    await startRun(o.id, { mode: 'triage' })
    expect(getOpportunity(o.id)).toMatchObject({ status: 'needs_choice', choice_reason: 'low', candidates: [{ domain: 'a.com' }] })

    runResearch.mockResolvedValueOnce({ kind: 'triage', result: validTriage({ name: 'A', domain: 'a.com' }), budget: budget() })
    await startRun(o.id, { mode: 'triage', companyDomain: 'a.com' })
    expect(runResearch.mock.calls[1]?.[0].companyDomain).toBe('a.com')
    expect(getOpportunity(o.id)).toMatchObject({ status: 'done', candidates: [], choice_reason: null })
  })

  it('records a failure with its message', async () => {
    runResearch.mockRejectedValueOnce(new Error('monthly cap of $20 reached'))
    const o = createOpportunity('text')
    await startRun(o.id, { mode: 'deep' })
    expect(getOpportunity(o.id)).toMatchObject({ status: 'failed', error: 'monthly cap of $20 reached' })
    expect(getOpportunity(o.id)?.runs[0]?.status).toBe('failed')
  })

  it('refuses to start a second run while one is active', async () => {
    let finish!: () => void
    runResearch.mockImplementationOnce(() => new Promise((r) => (finish = () => r({ kind: 'triage', result: validTriage({ name: 'E', domain: 'e.com' }), budget: budget() }))))
    const o = createOpportunity('text')
    const p = startRun(o.id, { mode: 'triage' })
    await expect(startRun(o.id, { mode: 'deep' })).rejects.toThrow(/already running/)
    finish()
    await p
  })
})

describe('reconcile', () => {
  it('marks a run whose process has exited as interrupted', () => {
    const o = { ...createOpportunity('x'), status: 'running' as const, runner_pid: 2 ** 22 + 12345 }
    expect(reconcile(o, () => false)).toMatchObject({ status: 'failed', error: expect.stringMatching(/interrupted/) })
  })

  it('leaves a run alone while another live process (the CLI) is running it', () => {
    const o = { ...createOpportunity('x'), status: 'running' as const, runner_pid: process.ppid } // a live process that is not this one
    expect(reconcile(o, () => false).status).toBe('running')
  })

  it('records the runner pid when a run starts', async () => {
    runResearch.mockResolvedValueOnce({ kind: 'triage', result: validTriage(), budget: budget() })
    const o = createOpportunity('x')
    const p = startRun(o.id, { mode: 'triage' })
    expect(getOpportunity(o.id)?.runner_pid).toBe(process.pid)
    await p
  })
})

it('shares active-run state across separate copies of the module (Next bundles each route apart)', async () => {
  let finish!: () => void
  runResearch.mockImplementationOnce(() => new Promise((r) => (finish = () => r({ kind: 'triage', result: validTriage(), budget: budget() }))))
  const o = createOpportunity('x')
  const p = startRun(o.id, { mode: 'triage' })
  vi.resetModules()
  const other = await import('./runner.js')
  expect(other.isActive(o.id)).toBe(true)
  finish()
  await p
})
