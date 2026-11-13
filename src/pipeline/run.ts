import type { Profile } from '../types/profile.js'
import type { CompanyResearch, RunEvent, StageName, StageStatus, TriageResult } from '../types/research.js'
import { runBudget, type Budget } from '../util/cost.js'
import { money } from './stage3-money.js'
import { people } from './stage4-people.js'
import { synthesize, type Draft } from './stage8-synthesize.js'
import { parse } from './stage0-parse.js'
import { gate, resolve, type Candidate } from './stage1-resolve.js'
import { triage } from './stage-triage.js'

export type { RunEvent }

export type RunOutcome =
  | { kind: 'report'; report: CompanyResearch; budget: Budget }
  | { kind: 'triage'; result: TriageResult; budget: Budget }
  | { kind: 'needs_choice'; reason: string; candidates: Candidate[]; gaps: string[]; budget: Budget }

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const unique = (xs: string[]) => [...new Set(xs)]

const EMPTY_MONEY = { ownership_type: null, funding_events: [], revenue_signal: null, profitability: null, exit_activity: [] }
const EMPTY_PEOPLE = { headcount: null, headcount_trend: null, layoff_events: [], leadership_changes: [], review_scores: [] }

export async function runResearch(input: {
  text: string
  mode: 'triage' | 'deep'
  profile: Profile | null
  companyDomain?: string
  onEvent?: (e: RunEvent) => void
}): Promise<RunOutcome> {
  const started = Date.now()
  const budget = runBudget(input.mode)
  const status: Partial<Record<StageName, StageStatus>> = {}
  const gaps: string[] = []
  const emit = (stage: StageName, s: RunEvent['status'], extra: Partial<RunEvent> = {}) =>
    input.onEvent?.({ stage, status: s, at: new Date().toISOString(), ...extra })

  /** Runs one stage, records its status and gaps, and reports progress. Never throws. */
  async function stage<T extends { data: { gaps?: string[] }; dropped: string[]; searchCapped?: boolean }>(
    name: StageName,
    fn: () => Promise<T>,
  ): Promise<T['data'] | null> {
    emit(name, 'started')
    try {
      const r = await fn()
      const s: StageStatus = r.searchCapped ? 'partial' : 'ok'
      status[name] = s
      if (r.searchCapped) gaps.push(`${name}: hit its search limit before finishing, so this section may be incomplete.`)
      gaps.push(...(r.data.gaps ?? []), ...r.dropped)
      emit(name, s, { output: r.data })
      return r.data
    } catch (e) {
      status[name] = 'failed'
      gaps.push(`${name} research did not complete: ${message(e)}`)
      emit(name, 'failed', { error: message(e) })
      return null
    }
  }

  // Stages 0 and 1 gate everything: if they fail there is no company to report on, so they throw.
  emit('parse', 'started')
  const parsed = await parse(input.text, budget).catch((e) => (emit('parse', 'failed', { error: message(e) }), Promise.reject(e)))
  status.parse = 'ok'
  emit('parse', 'ok', { output: parsed })

  emit('resolve', 'started')
  const { out, dropped } = await resolve(parsed, budget, input.companyDomain).catch(
    (e) => (emit('resolve', 'failed', { error: message(e) }), Promise.reject(e)),
  )
  const g = gate(out, input.companyDomain)
  if (g === 'mismatch') {
    const msg = out.identity
      ? `you gave ${input.companyDomain}, but research resolved ${out.identity.domain}; check the domain`
      : `could not source the identity of ${input.companyDomain} (legal name, HQ, public status):\n  ${[...out.gaps, ...dropped].join('\n  ')}`
    emit('resolve', 'failed', { error: msg })
    throw new Error(msg)
  }
  if (g === 'ask' || !out.identity) {
    const reason = out.identity
      ? `resolution confidence ${out.identity.resolution_confidence} is below 0.8`
      : 'the top candidate could not be sourced well enough to confirm its identity'
    emit('resolve', 'partial', { output: out })
    return { kind: 'needs_choice', reason, candidates: out.candidates, gaps: [...out.gaps, ...dropped], budget }
  }
  const identity = out.identity
  status.resolve = 'ok'
  gaps.push(...out.gaps, ...dropped)
  emit('resolve', 'ok', { output: out })

  const run = (mode: 'triage' | 'deep') => ({
    mode,
    searches_used: budget.total.searches,
    input_tokens: budget.total.input + budget.total.cacheRead + budget.total.cacheWrite,
    output_tokens: budget.total.output,
    cost_usd: Number(budget.total.usd.toFixed(4)),
    duration_ms: Date.now() - started,
    stage_status: status,
  })
  const partial = () => Object.values(status).some((s) => s !== 'ok')

  if (input.mode === 'triage') {
    const t = await stage('triage', () => triage(identity, budget))
    const result: TriageResult = {
      schema_version: 2,
      generated_at: new Date().toISOString(),
      partial: partial(),
      identity,
      role: parsed.role,
      flags: t?.flags ?? [],
      deep_dive: t?.deep_dive ?? { recommended: true, reason: 'The quick check did not complete, so nothing rules this company out yet.' },
      gaps: unique(gaps),
      run: run('triage'),
    }
    return { kind: 'triage', result, budget }
  }

  const [m, p] = await Promise.all([stage('money', () => money(identity, budget)), stage('people', () => people(identity, budget))])
  const strip = <T extends { gaps: string[] }>({ gaps: _g, ...rest }: T) => rest
  const draft: Draft = {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    partial: partial(),
    identity,
    money: m ? strip(m) : EMPTY_MONEY,
    people: p ? strip(p) : EMPTY_PEOPLE,
    role: parsed.role,
    gaps: unique(gaps),
    run: run('deep'),
  }

  const s = await stage('synthesize', () => synthesize({ draft, profile: input.profile }, budget))
  const report: CompanyResearch = {
    ...draft,
    partial: partial(),
    flags: s?.flags ?? [],
    scores: s?.scores ?? [],
    questions_to_ask: s?.questions_to_ask ?? [],
    verdict: s?.verdict ?? 'Synthesis did not complete, so there are no flags, scores or verdict. The sourced research below is still valid.',
    gaps: unique(gaps),
    run: run('deep'),
  }
  return { kind: 'report', report, budget }
}
