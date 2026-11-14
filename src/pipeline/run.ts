import type { Profile } from '../types/profile'
import type { CompanyResearch, Flag, RunEvent, StageName, StageStatus, TriageResult } from '../types/research'
import { runBudget, type Budget, type Spend } from '../util/cost'
import { parse, type ParseOut } from './stage0-parse'
import { gate, resolve, type Candidate, type ResolveOut } from './stage1-resolve'
import { business, type BusinessOut } from './stage2-business'
import { money, type MoneyOut } from './stage3-money'
import { people, type PeopleOut } from './stage4-people'
import { market, type MarketOut } from './stage5-market'
import { synthesize, type Draft, type SynthOut } from './stage8-synthesize'
import { triage, type TriageOut } from './stage-triage'

export type { RunEvent }

export type RunOutcome =
  | { kind: 'report'; report: CompanyResearch; budget: Budget }
  | { kind: 'triage'; result: TriageResult; budget: Budget }
  | { kind: 'needs_choice'; reason: string; candidates: Candidate[]; gaps: string[]; budget: Budget }

/** What one stage produced. Plain data, so it can cross a durable-workflow step boundary. */
export interface StageResult<T> {
  data: T | null
  dropped: string[]
  searchCapped: boolean
  error?: string
}

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const unique = (xs: string[]) => [...new Set(xs)]

export const statusOf = (r: StageResult<unknown>): StageStatus => (r.error || r.data === null ? 'failed' : r.searchCapped ? 'partial' : 'ok')

/** The gaps a stage contributes: its own, what it dropped, and why it stopped if it did. */
export function stageGaps(name: StageName, r: StageResult<{ gaps?: string[] }>): string[] {
  if (r.error || r.data === null) return [`${name} research did not complete: ${r.error ?? 'no result'}`]
  return [...(r.searchCapped ? [`${name}: hit its search limit before finishing, so this section may be incomplete.`] : []), ...(r.data.gaps ?? []), ...r.dropped]
}

export type GateResult =
  | { kind: 'pass'; identity: NonNullable<ResolveOut['identity']>; gaps: string[] }
  | { kind: 'ask'; reason: string; candidates: Candidate[]; gaps: string[] }
  | { kind: 'mismatch'; message: string }

export function gateOutcome(out: ResolveOut, dropped: string[], companyDomain?: string): GateResult {
  const g = gate(out, companyDomain)
  if (g === 'mismatch')
    return {
      kind: 'mismatch',
      message: out.identity
        ? `you gave ${companyDomain}, but research resolved ${out.identity.domain}; check the domain`
        : `could not identify the company at ${companyDomain}:\n  ${[...out.gaps, ...dropped].join('\n  ')}`,
    }
  if (g === 'ask' || !out.identity)
    return {
      kind: 'ask',
      reason: out.identity ? `resolution confidence ${out.identity.resolution_confidence} is below 0.8` : 'no company could be identified from the text',
      candidates: out.candidates,
      gaps: [...out.gaps, ...dropped],
    }
  return { kind: 'pass', identity: out.identity, gaps: [...out.gaps, ...dropped] }
}

export interface Totals {
  spend: Spend
  durationMs: number
}

const runField = (mode: 'triage' | 'deep', t: Totals, stage_status: Partial<Record<StageName, StageStatus>>) => ({
  mode,
  searches_used: t.spend.searches,
  input_tokens: t.spend.input + t.spend.cacheRead + t.spend.cacheWrite,
  output_tokens: t.spend.output,
  cost_usd: Number(t.spend.usd.toFixed(4)),
  duration_ms: t.durationMs,
  stage_status,
})

const EMPTY_MONEY = { ownership_type: null, funding_events: [], revenue_signal: null, profitability: null, exit_activity: [] }
const EMPTY_PEOPLE = { headcount: null, headcount_trend: null, layoff_events: [], leadership_changes: [], review_scores: [] }
const strip = <T extends { gaps: string[] }>({ gaps: _g, ...rest }: T) => rest

type Identity = NonNullable<ResolveOut['identity']>

/** The research so far, as stage 8 sees it. */
/** The four deep research stages, which run in parallel. */
export interface DeepStages {
  business: StageResult<BusinessOut>
  money: StageResult<MoneyOut>
  people: StageResult<PeopleOut>
  market: StageResult<MarketOut>
}

export function draftReport(p: { parsed: ParseOut; identity: Identity; resolveGaps: string[]; totals: Totals } & DeepStages): Draft {
  const status = { parse: 'ok', resolve: 'ok', business: statusOf(p.business), money: statusOf(p.money), people: statusOf(p.people), market: statusOf(p.market) } as const
  return {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    partial: Object.values(status).some((s) => s !== 'ok'),
    identity: p.identity,
    business: p.business.data ? strip(p.business.data) : null,
    money: p.money.data ? strip(p.money.data) : EMPTY_MONEY,
    people: p.people.data ? strip(p.people.data) : EMPTY_PEOPLE,
    market: p.market.data ? strip(p.market.data) : null,
    role: p.parsed.role,
    gaps: unique([
      ...p.resolveGaps,
      ...stageGaps('business', p.business),
      ...stageGaps('money', p.money),
      ...stageGaps('people', p.people),
      ...stageGaps('market', p.market),
    ]),
    run: runField('deep', p.totals, status),
  }
}

export function assembleReport(draft: Draft, synth: StageResult<SynthOut>, totals: Totals): CompanyResearch {
  const stage_status = { ...draft.run.stage_status, synthesize: statusOf(synth) }
  const s = synth.data
  return {
    ...draft,
    partial: Object.values(stage_status).some((x) => x !== 'ok'),
    flags: s?.flags ?? [],
    scores: s?.scores ?? [],
    questions_to_ask: (s?.questions ?? []).map((q) => q.question),
    questions: s?.questions ?? [],
    outlook: s?.outlook ?? null,
    verdict: s?.verdict ?? 'Synthesis did not complete, so there are no flags, scores or verdict. The sourced research below is still valid.',
    // Synthesis gaps are the curated, decision-relevant ones; stage notes and dropped claims follow.
    gaps: unique([...(s?.gaps ?? []), ...draft.gaps, ...(s ? synth.dropped : stageGaps('synthesize', synth))]),
    run: runField('deep', totals, stage_status),
  }
}

export function assembleTriage(p: { parsed: ParseOut; identity: Identity; resolveGaps: string[]; triage: StageResult<TriageOut>; totals: Totals }): TriageResult {
  const stage_status = { parse: 'ok', resolve: 'ok', triage: statusOf(p.triage) } as const
  return {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    partial: stage_status.triage !== 'ok',
    identity: p.identity,
    role: p.parsed.role,
    flags: (p.triage.data?.flags ?? []) as Flag[],
    deep_dive: p.triage.data?.deep_dive ?? { recommended: true, reason: 'The quick check did not complete, so nothing rules this company out yet.' },
    gaps: unique([...p.resolveGaps, ...stageGaps('triage', p.triage)]),
    run: runField('triage', p.totals, stage_status),
  }
}

/** Runs a stage and turns any failure into a result, so one stage failing degrades the report instead of killing it. */
export async function settle<T>(fn: () => Promise<{ data: T; dropped: string[]; searchCapped?: boolean }>): Promise<StageResult<T>> {
  try {
    const r = await fn()
    return { data: r.data, dropped: r.dropped, searchCapped: r.searchCapped ?? false }
  } catch (e) {
    return { data: null, dropped: [], searchCapped: false, error: message(e) }
  }
}

/**
 * The whole pipeline in one process (CLI and evals). The web app runs the same stages as a
 * durable workflow (src/workflows/research.ts) built from the same helpers.
 */
export async function runResearch(input: {
  text: string
  mode: 'triage' | 'deep'
  profile: Profile | null
  companyDomain?: string
  runId?: string | null
  onEvent?: (e: RunEvent) => void | Promise<void>
}): Promise<RunOutcome> {
  const started = Date.now()
  const budget = await runBudget(input.mode, input.runId ?? null)
  const emit = async (stage: StageName, status: RunEvent['status'], extra: Partial<RunEvent> = {}) =>
    input.onEvent?.({ stage, status, at: new Date().toISOString(), ...extra })
  const totals = (): Totals => ({ spend: { ...budget.total }, durationMs: Date.now() - started })

  async function stage<T>(name: StageName, fn: () => Promise<{ data: T; dropped: string[]; searchCapped?: boolean }>) {
    await emit(name, 'started')
    const r = await settle(fn)
    await emit(name, statusOf(r), r.error ? { error: r.error } : { output: r.data })
    return r
  }

  // Stages 0 and 1 gate everything: if they fail there is no company to report on, so they throw.
  await emit('parse', 'started')
  const parsed = await parse(input.text, budget).catch(async (e) => (await emit('parse', 'failed', { error: message(e) }), Promise.reject(e)))
  await emit('parse', 'ok', { output: parsed })

  await emit('resolve', 'started')
  const { out, dropped } = await resolve(parsed, budget, input.companyDomain).catch(
    async (e) => (await emit('resolve', 'failed', { error: message(e) }), Promise.reject(e)),
  )
  const g = gateOutcome(out, dropped, input.companyDomain)
  if (g.kind === 'mismatch') {
    await emit('resolve', 'failed', { error: g.message })
    throw new Error(g.message)
  }
  if (g.kind === 'ask') {
    await emit('resolve', 'partial', { output: out })
    return { kind: 'needs_choice', reason: g.reason, candidates: g.candidates, gaps: g.gaps, budget }
  }
  await emit('resolve', 'ok', { output: out })

  if (input.mode === 'triage') {
    const t = await stage('triage', () => triage(g.identity, budget))
    return { kind: 'triage', result: assembleTriage({ parsed, identity: g.identity, resolveGaps: g.gaps, triage: t, totals: totals() }), budget }
  }

  const [b, m, p, k] = await Promise.all([
    stage('business', () => business(g.identity, budget)),
    stage('money', () => money(g.identity, budget)),
    stage('people', () => people(g.identity, budget)),
    stage('market', () => market(g.identity, budget)),
  ])
  const draft = draftReport({ parsed, identity: g.identity, resolveGaps: g.gaps, business: b, money: m, people: p, market: k, totals: totals() })
  const s = await stage('synthesize', () => synthesize({ draft, profile: input.profile }, budget))
  return { kind: 'report', report: assembleReport(draft, s, totals()), budget }
}
