import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { BUDGETS } from '../config.js'
import type { StageName } from '../types/research.js'

export interface Spend {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  searches: number
  usd: number
}
export type Usage = Omit<Spend, 'usd'>

// USD per million tokens: [input, output, cache read, 5-minute cache write]. Check platform.claude.com pricing.
const PER_MTOK: Record<string, readonly [number, number, number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125],
  'claude-sonnet-5-5': [2, 10, 0.1, 2.5],
  'claude-opus-5-5': [4, 20, 0.2, 5],
}
const HAIKU_LONG_PROMPT = [0.5, 2.5, 0.05, 0.625] as const // Haiku 5.5 prompts over 100k tokens
// shortcut: a refusal fallback can answer from a model not listed above; it is priced at these
// conservative rates rather than exactly. Add the model to PER_MTOK if it shows up in the logs.
const UNKNOWN_MODEL = [5, 25, 0.5, 6.25] as const
export const SEARCH_USD = 0.01

export const zeroSpend = (): Spend => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0, usd: 0 })
export const totalTokens = (s: Usage) => s.input + s.output + s.cacheRead + s.cacheWrite

export function costUsd(model: string, u: Usage): number {
  const prompt = u.input + u.cacheRead + u.cacheWrite
  const [i, o, cr, cw] =
    model === 'claude-haiku-5-5' && prompt > 100_000 ? HAIKU_LONG_PROMPT : (PER_MTOK[model] ?? UNKNOWN_MODEL)
  return (u.input * i + u.output * o + u.cacheRead * cr + u.cacheWrite * cw) / 1e6 + u.searches * SEARCH_USD
}

export class BudgetExceeded extends Error {}

/** Per-run accounting with hard limits. Every API call is charged here; the next call is refused once a limit is hit. */
export class Budget {
  readonly stages: Partial<Record<StageName, Spend>> = {}
  readonly total: Spend = zeroSpend()

  constructor(
    private readonly limits: { searchesPerRun: number; tokensPerRun: number },
    private readonly month: { spentBefore: number; capUsd: number; record?: (monthTotalUsd: number) => void },
  ) {}

  get remainingSearches(): number {
    return Math.max(0, this.limits.searchesPerRun - this.total.searches)
  }

  assertCanSpend(): void {
    if (this.month.spentBefore + this.total.usd >= this.month.capUsd)
      throw new BudgetExceeded(`monthly cap of $${this.month.capUsd} reached`)
    if (totalTokens(this.total) >= this.limits.tokensPerRun)
      throw new BudgetExceeded(`run token cap of ${this.limits.tokensPerRun} reached`)
  }

  charge(stage: StageName, model: string, u: Usage): number {
    const usd = costUsd(model, u)
    const s = (this.stages[stage] ??= zeroSpend())
    for (const t of [s, this.total]) {
      t.input += u.input
      t.output += u.output
      t.cacheRead += u.cacheRead
      t.cacheWrite += u.cacheWrite
      t.searches += u.searches
      t.usd += usd
    }
    this.month.record?.(this.month.spentBefore + this.total.usd)
    return usd
  }
}

// Monthly spend ledger: { "2026-11": 3.21 }. Evals count toward the cap too.
// shortcut: two runs in parallel processes can overwrite each other's total; fine for one user.
const LEDGER = 'cache/spend.json'
const monthKey = (d = new Date()) => d.toISOString().slice(0, 7)

function readLedger(file: string): Record<string, number> {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, number>) : {}
}

export function monthSpend(file = LEDGER): number {
  return readLedger(file)[monthKey()] ?? 0
}

export function runBudget(mode: 'triage' | 'deep', file = LEDGER): Budget {
  const month = monthKey()
  return new Budget(BUDGETS[mode], {
    spentBefore: readLedger(file)[month] ?? 0,
    capUsd: BUDGETS.monthlyUsd,
    record: (usd) => {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify({ ...readLedger(file), [month]: Number(usd.toFixed(6)) }, null, 2))
    },
  })
}
