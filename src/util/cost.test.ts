import { beforeEach, describe, expect, it } from 'vitest'
import { useTestDb } from '../db/db'
import { Budget, BudgetExceeded, costUsd, monthSpend, runBudget, runSpend } from './cost'

const u = (input: number, output: number, searches = 0) => ({ input, output, cacheRead: 0, cacheWrite: 0, searches })

describe('costUsd', () => {
  it('prices tokens and searches', () => {
    expect(costUsd('claude-sonnet-5-5', u(1_000_000, 100_000, 10))).toBeCloseTo(2 + 1 + 0.1)
    expect(costUsd('claude-opus-5-5', u(0, 1_000_000))).toBeCloseTo(20)
  })
  it('bills Haiku prompts over 100k at the long-prompt rate', () => {
    expect(costUsd('claude-haiku-5-5', u(100_000, 0))).toBeCloseTo(0.01)
    expect(costUsd('claude-haiku-5-5', u(200_000, 0))).toBeCloseTo(0.1)
  })
  it('prices an unknown fallback model conservatively', () =>
    expect(costUsd('claude-something-else', u(1_000_000, 0))).toBeCloseTo(5))
})

describe('Budget', () => {
  const month = { spentBefore: 0, capUsd: 20 }
  it('tracks per stage and in total', () => {
    const b = new Budget({ searchesPerRun: 40, tokensPerRun: 1e6 }, month)
    b.charge('money', 'claude-sonnet-5-5', u(1000, 100, 3))
    b.charge('people', 'claude-sonnet-5-5', u(1000, 100, 4))
    expect(b.stages.money?.searches).toBe(3)
    expect(b.total.searches).toBe(7)
    expect(b.remainingSearches).toBe(33)
  })
  it('refuses the next call once the run token cap is reached', () => {
    const b = new Budget({ searchesPerRun: 40, tokensPerRun: 1000 }, month)
    b.assertCanSpend()
    b.charge('money', 'claude-sonnet-5-5', u(900, 100))
    expect(() => b.assertCanSpend()).toThrow(BudgetExceeded)
  })
  it('refuses once this month plus this run reaches the cap', () => {
    expect(() => new Budget({ searchesPerRun: 40, tokensPerRun: 1e9 }, { spentBefore: 20, capUsd: 20 }).assertCanSpend()).toThrow(/monthly cap/)
    const b = new Budget({ searchesPerRun: 40, tokensPerRun: 1e9 }, { spentBefore: 19.5, capUsd: 20 })
    b.charge('synthesize', 'claude-opus-5-5', u(0, 30_000)) // $0.60
    expect(() => b.assertCanSpend()).toThrow(/monthly cap/)
  })
})

describe('ledger', () => {
  beforeEach(async () => {
    await useTestDb()
  })

  it('persists every charge, so the month total survives across runs and processes', async () => {
    expect(await monthSpend()).toBe(0)
    const a = await runBudget('deep', null)
    a.charge('money', 'claude-sonnet-5-5', u(1_000_000, 0))
    await a.flush()
    const b = await runBudget('deep', null)
    b.charge('money', 'claude-sonnet-5-5', u(500_000, 0))
    await b.flush()
    expect(await monthSpend()).toBeCloseTo(3)
  })

  it('a new budget for an existing run starts from what that run already spent', async () => {
    const db = await useTestDb()
    await db.query("insert into opportunities (id, owner_id, text) values ('o', '00000000-0000-0000-0000-000000000001', 't')")
    await db.query("insert into runs (id, opportunity_id, owner_id, mode) values ('r', 'o', '00000000-0000-0000-0000-000000000001', 'deep')")
    const first = await runBudget('deep', 'r')
    first.charge('money', 'claude-sonnet-5-5', u(1000, 0, 7))
    await first.flush()
    const second = await runBudget('deep', 'r')
    expect(second.remainingSearches).toBe(33)
    expect(await runSpend('r')).toMatchObject({ searches: 7, stages: { money: { searches: 7 } } })
  })

  it('the monthly cap holds across separate budgets', async () => {
    const a = await runBudget('deep', null)
    a.charge('synthesize', 'claude-opus-5-5', u(0, 1_000_000)) // $20
    await a.flush()
    const next = await runBudget('triage', null)
    expect(() => next.assertCanSpend()).toThrow(/monthly cap/)
  })
})
