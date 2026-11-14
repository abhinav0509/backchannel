import Anthropic from '@anthropic-ai/sdk'
import { FatalError } from 'workflow'
import { assembleReport, assembleTriage, draftReport, gateOutcome, message, settle, statusOf, type DeepStages, type GateResult, type StageResult, type Totals } from '../pipeline/run'
import { parse, type ParseOut } from '../pipeline/stage0-parse'
import { resolve, type ResolveOut } from '../pipeline/stage1-resolve'
import { business, type BusinessOut } from '../pipeline/stage2-business'
import { money, type MoneyOut } from '../pipeline/stage3-money'
import { people, type PeopleOut } from '../pipeline/stage4-people'
import { market, type MarketOut } from '../pipeline/stage5-market'
import { contacts, type ContactsInput, type ContactsOut } from '../pipeline/stage6-contacts'
import { synthesize, type Draft, type SynthOut } from '../pipeline/stage8-synthesize'
import { triage, type TriageOut } from '../pipeline/stage-triage'
import { getDb } from '../db/db'
import { recordEvent } from '../store/repo'
import { applyOutcome, profileFor, type Outcome } from '../store/runner'
import type { RunEvent, StageName } from '../types/research'
import { runBudget, runSpend } from '../util/cost'

/** Everything a step needs, as plain data: steps run in separate invocations and share nothing in memory. */
export interface Ctx {
  owner: string
  oppId: string
  runId: string
  mode: 'triage' | 'deep'
  text: string
  companyDomain?: string
}
type Identity = NonNullable<ResolveOut['identity']>

const emit = (c: Ctx, stage: StageName, status: RunEvent['status'], extra: Partial<RunEvent> = {}) =>
  recordEvent(c.owner, c.oppId, c.runId, { stage, status, at: new Date().toISOString(), ...extra })

/** Network blips, rate limits and overloads are worth a retry; bad output, refusals and spent budgets are not. */
export const isTransient = (e: unknown) =>
  e instanceof Anthropic.APIConnectionError || (e instanceof Anthropic.APIError && (e.status === 429 || (e.status ?? 0) >= 500))

async function totals(c: Ctx): Promise<Totals> {
  const [run] = await (await getDb()).query<{ started_at: Date }>('select started_at from runs where id = $1', [c.runId])
  return { spend: await runSpend(c.runId), durationMs: Date.now() - (run?.started_at.getTime() ?? Date.now()) }
}

export async function parseStep(c: Ctx): Promise<ParseOut> {
  "use step"
  await emit(c, 'parse', 'started')
  try {
    const out = await parse(c.text, await runBudget(c.mode, c.runId))
    await emit(c, 'parse', 'ok', { output: out })
    return out
  } catch (e) {
    if (isTransient(e)) throw e
    await emit(c, 'parse', 'failed', { error: message(e) })
    throw new FatalError(message(e))
  }
}

export async function resolveStep(c: Ctx, parsed: ParseOut): Promise<GateResult> {
  "use step"
  await emit(c, 'resolve', 'started')
  let r: { out: ResolveOut; dropped: string[] }
  try {
    r = await resolve(parsed, await runBudget(c.mode, c.runId), c.companyDomain)
  } catch (e) {
    if (isTransient(e)) throw e
    await emit(c, 'resolve', 'failed', { error: message(e) })
    throw new FatalError(message(e))
  }
  const g = gateOutcome(r.out, r.dropped, c.companyDomain)
  await emit(c, 'resolve', g.kind === 'pass' ? 'ok' : g.kind === 'ask' ? 'partial' : 'failed', g.kind === 'mismatch' ? { error: g.message } : { output: r.out })
  return g
}

const STAGES = { business, money, people, market, contacts, triage } as const
interface StageOut {
  business: BusinessOut
  money: MoneyOut
  people: PeopleOut
  market: MarketOut
  contacts: ContactsOut
  triage: TriageOut
}

/** One research stage. Settles every failure except transient ones, which it rethrows for the workflow to retry. */
export async function researchStep<K extends keyof typeof STAGES>(c: Ctx, name: K, identity: Identity & Partial<ContactsInput>): Promise<StageResult<StageOut[K]>> {
  "use step"
  await emit(c, name, 'started')
  const budget = await runBudget(c.mode, c.runId)
  let transient: unknown
  const r = await settle(async () => {
    try {
      return await (STAGES[name] as typeof money)(identity, budget)
    } catch (e) {
      if (isTransient(e)) transient = e
      throw e
    }
  })
  if (transient) throw transient
  await emit(c, name, statusOf(r), r.error ? { error: r.error } : { output: r.data })
  return r as never
}

export async function synthStep(c: Ctx, parsed: ParseOut, gate: Extract<GateResult, { kind: 'pass' }>, stages: DeepStages): Promise<{ draft: Draft; synth: StageResult<SynthOut> }> {
  "use step"
  const draft = draftReport({ parsed, identity: gate.identity, resolveGaps: gate.gaps, ...stages, totals: await totals(c) })
  await emit(c, 'synthesize', 'started')
  const budget = await runBudget(c.mode, c.runId)
  const profile = await profileFor(c.owner)
  let transient: unknown
  const synth = await settle(async () => {
    try {
      return await synthesize({ draft, profile }, budget)
    } catch (e) {
      if (isTransient(e)) transient = e
      throw e
    }
  })
  if (transient) throw transient
  await emit(c, 'synthesize', statusOf(synth), synth.error ? { error: synth.error } : { output: synth.data })
  return { draft, synth }
}

/** Assembles and stores how the run ended. */
export async function finishStep(
  c: Ctx,
  end:
    | { kind: 'report'; draft: Draft; synth: StageResult<SynthOut> }
    | { kind: 'triage'; parsed: ParseOut; gate: Extract<GateResult, { kind: 'pass' }>; triage: StageResult<TriageOut> }
    | { kind: 'ask'; gate: Extract<GateResult, { kind: 'ask' }> }
    | { kind: 'failed'; error: string },
): Promise<void> {
  "use step"
  let outcome: Outcome
  if (end.kind === 'report') outcome = { kind: 'report', report: assembleReport(end.draft, end.synth, await totals(c)) }
  else if (end.kind === 'triage')
    outcome = { kind: 'triage', result: assembleTriage({ parsed: end.parsed, identity: end.gate.identity, resolveGaps: end.gate.gaps, triage: end.triage, totals: await totals(c) }) }
  else if (end.kind === 'ask') outcome = { kind: 'needs_choice', reason: end.gate.reason, candidates: end.gate.candidates }
  else outcome = { kind: 'failed', error: end.error }
  await applyOutcome(c.owner, c.oppId, c.runId, outcome)
}
