import { beforeEach, describe, expect, it } from 'vitest'
import { useTestDb } from '../db/db'
import { BUDGETS } from '../config'
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

describe('per-person caps', () => {
  const MEMBER = '00000000-0000-0000-0000-00000000000b'
  const ADMIN = '00000000-0000-0000-0000-000000000001' // the local owner is the admin without BACKCHANNEL_OWNER
  async function runFor(owner: string, id: string) {
    const db = await useTestDb()
    await db.query('insert into opportunities (id, owner_id, text) values ($1, $2, $3)', [`o-${id}`, owner, 't'])
    await db.query("insert into runs (id, opportunity_id, owner_id, mode) values ($1, $2, $3, 'deep')", [id, `o-${id}`, owner])
    return db
  }
  beforeEach(async () => {
    await useTestDb()
  })

  it('records whose spend each charge is', async () => {
    const db = await runFor(MEMBER, 'm1')
    const b = await runBudget('deep', 'm1')
    b.charge('money', 'claude-sonnet-5-5', u(1000, 0))
    await b.flush()
    expect(await db.query('select owner_id from spend')).toEqual([{ owner_id: MEMBER }])
    expect(await monthSpend(MEMBER)).toBeGreaterThan(0)
    expect(await monthSpend(ADMIN)).toBe(0)
  })

  it('an invitee stops at their own monthly cap, while the overall cap still has room', async () => {
    await runFor(MEMBER, 'm1')
    const a = await runBudget('deep', 'm1')
    a.charge('synthesize', 'claude-opus-5-5', u(0, (BUDGETS.memberMonthlyUsd / 20) * 1_000_000))
    await a.flush()
    const next = await runBudget('deep', 'm1')
    expect(() => next.assertCanSpend()).toThrow(/your monthly limit of \$5/)
  })

  it('the admin is held only to the overall cap', async () => {
    await runFor(ADMIN, 'a1')
    const a = await runBudget('deep', 'a1')
    a.charge('synthesize', 'claude-opus-5-5', u(0, (BUDGETS.memberMonthlyUsd / 20) * 1_000_000))
    await a.flush()
    expect(() => a.assertCanSpend()).not.toThrow()
  })

  it('says how much someone can still spend this month, and whether a run of each kind fits', async () => {
    const { allowance } = await import('./cost')
    await runFor(MEMBER, 'm1')
    const a = await runBudget('deep', 'm1')
    a.charge('synthesize', 'claude-opus-5-5', u(0, 200_000)) // $4
    await a.flush()
    const left = await allowance(MEMBER)
    expect(left.remainingUsd).toBeCloseTo(1)
    expect(left.capUsd).toBe(BUDGETS.memberMonthlyUsd)
    expect(left.fits).toEqual({ triage: true, deep: false })
    expect((await allowance(ADMIN)).capUsd).toBe(BUDGETS.monthlyUsd)
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
    expect(second.remainingSearches).toBe(BUDGETS.deep.searchesPerRun - 7)
    expect(await runSpend('r')).toMatchObject({ searches: 7, stages: { money: { searches: 7 } } })
  })

  it('the monthly cap holds across separate budgets', async () => {
    const a = await runBudget('deep', null)
    a.charge('synthesize', 'claude-opus-5-5', u(0, (BUDGETS.monthlyUsd / 20) * 1_000_000)) // $20 per million output tokens
    await a.flush()
    const next = await runBudget('triage', null)
    expect(() => next.assertCanSpend()).toThrow(/monthly cap/)
  })
})
