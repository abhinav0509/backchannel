import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Budget, BudgetExceeded, costUsd, monthSpend, runBudget } from './cost.js'

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
  it('persists the month total after every charge', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'bc-')), 'spend.json')
    expect(monthSpend(file)).toBe(0)
    runBudget('deep', file).charge('money', 'claude-sonnet-5-5', u(1_000_000, 0))
    const second = runBudget('deep', file)
    second.charge('money', 'claude-sonnet-5-5', u(500_000, 0))
    expect(monthSpend(file)).toBeCloseTo(3)
    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')))[0]).toMatch(/^\d{4}-\d{2}$/)
  })
})
