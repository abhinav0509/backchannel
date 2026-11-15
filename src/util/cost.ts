import { BUDGETS, ESTIMATE_USD } from '../config'
import { isAdminOwner } from '../server/auth'
import { getDb } from '../db/db'
import type { StageName } from '../types/research'

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

type Persist = (stage: StageName, model: string, u: Usage, usd: number) => Promise<void>

/**
 * Per-run accounting with hard limits. Every API call is charged here and the next call is
 * refused once a limit is hit. Charges are persisted (see flush) so the monthly cap holds across
 * processes, durable workflow steps and the CLI.
 */
export class Budget {
  readonly stages: Partial<Record<StageName, Spend>> = {}
  readonly total: Spend
  private pending: Promise<void>[] = []

  constructor(
    private readonly limits: { searchesPerRun: number; tokensPerRun: number },
    private readonly month: { spentBefore: number; capUsd: number },
    private readonly opts: { initial?: Spend; persist?: Persist; member?: { spentBefore: number; capUsd: number } } = {},
  ) {
    this.total = { ...(opts.initial ?? zeroSpend()) }
  }

  get remainingSearches(): number {
    return Math.max(0, this.limits.searchesPerRun - this.total.searches)
  }

  assertCanSpend(): void {
    if (this.month.spentBefore + this.total.usd >= this.month.capUsd)
      throw new BudgetExceeded(`monthly cap of $${this.month.capUsd} reached`)
    const m = this.opts.member
    if (m && m.spentBefore + this.total.usd >= m.capUsd) throw new BudgetExceeded(`your monthly limit of $${m.capUsd} is reached`)
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
    if (this.opts.persist) this.pending.push(this.opts.persist(stage, model, u, usd))
    return usd
  }

  /** Waits until every charge so far is written. Call before the next billed request. */
  async flush(): Promise<void> {
    const p = this.pending
    this.pending = []
    await Promise.all(p)
  }
}

const SPEND_COLUMNS = `coalesce(sum(input_tokens), 0)::int as input, coalesce(sum(output_tokens), 0)::int as output,
  coalesce(sum(cache_read_tokens), 0)::int as "cacheRead", coalesce(sum(cache_write_tokens), 0)::int as "cacheWrite",
  coalesce(sum(searches), 0)::int as searches, coalesce(sum(usd), 0)::float8 as usd`

const MONTH = "at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'"

/** Spend recorded since the start of this calendar month (UTC): everyone's, or one person's. */
export async function monthSpend(owner?: string): Promise<number> {
  const [row] = await (await getDb()).query<{ usd: number }>(
    `select coalesce(sum(usd), 0)::float8 as usd from spend where ${MONTH}${owner ? ' and owner_id = $1' : ''}`,
    owner ? [owner] : [],
  )
  return row?.usd ?? 0
}

/** What someone can still spend this month, under their own limit and the overall cap, and which runs fit. */
export async function allowance(owner: string) {
  const overall = await monthSpend()
  const admin = isAdminOwner(owner)
  const mine = admin ? overall : await monthSpend(owner)
  const capUsd = admin ? BUDGETS.monthlyUsd : BUDGETS.memberMonthlyUsd
  const remainingUsd = Math.max(0, Math.min(BUDGETS.monthlyUsd - overall, capUsd - mine))
  return { capUsd, spentUsd: mine, remainingUsd, fits: { triage: remainingUsd >= ESTIMATE_USD.triage, deep: remainingUsd >= ESTIMATE_USD.deep } }
}

/** One run's totals and per-stage breakdown. */
export async function runSpend(runId: string): Promise<Spend & { stages: Partial<Record<StageName, Spend>> }> {
  const db = await getDb()
  const [total] = await db.query<Spend>(`select ${SPEND_COLUMNS} from spend where run_id = $1`, [runId])
  const rows = await db.query<Spend & { stage: StageName }>(`select stage, ${SPEND_COLUMNS} from spend where run_id = $1 group by stage`, [runId])
  return { ...(total ?? zeroSpend()), stages: Object.fromEntries(rows.map(({ stage, ...s }) => [stage, s])) }
}

/** A budget for a run (or for one durable step of it), seeded with what the month and the run have already spent. */
export async function runBudget(mode: 'triage' | 'deep', runId: string | null): Promise<Budget> {
  const db = await getDb()
  const [run] = runId ? await db.query<{ owner_id: string }>('select owner_id from runs where id = $1', [runId]) : []
  const owner = run?.owner_id ?? null
  const member = owner !== null && !isAdminOwner(owner)
  const [month, mine, initial] = await Promise.all([
    monthSpend(),
    member ? monthSpend(owner) : Promise.resolve(0),
    runId ? runSpend(runId) : Promise.resolve(zeroSpend()),
  ])
  return new Budget(
    BUDGETS[mode],
    { spentBefore: month - initial.usd, capUsd: BUDGETS.monthlyUsd },
    {
      initial: { input: initial.input, output: initial.output, cacheRead: initial.cacheRead, cacheWrite: initial.cacheWrite, searches: initial.searches, usd: initial.usd },
      ...(member && { member: { spentBefore: mine - initial.usd, capUsd: BUDGETS.memberMonthlyUsd } }),
      persist: async (stage, model, u, usd) => {
        await db.query(
          `insert into spend (run_id, owner_id, stage, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, searches, usd)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [runId, owner, stage, model, u.input, u.output, u.cacheRead, u.cacheWrite, u.searches, usd],
        )
      },
    },
  )
}

/** A small budget for one-off work that belongs to a person but not to a research run, such as reading a CV. */
export async function ownerBudget(owner: string): Promise<Budget> {
  const db = await getDb()
  const member = !isAdminOwner(owner)
  const [month, mine] = await Promise.all([monthSpend(), member ? monthSpend(owner) : Promise.resolve(0)])
  return new Budget(
    { searchesPerRun: 0, tokensPerRun: 200_000 },
    { spentBefore: month, capUsd: BUDGETS.monthlyUsd },
    {
      ...(member && { member: { spentBefore: mine, capUsd: BUDGETS.memberMonthlyUsd } }),
      persist: async (stage, model, u, usd) => {
        await db.query(
          `insert into spend (run_id, owner_id, stage, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, searches, usd)
           values (null, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [owner, stage, model, u.input, u.output, u.cacheRead, u.cacheWrite, u.searches, usd],
        )
      },
    },
  )
}
