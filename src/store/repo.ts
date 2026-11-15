import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { getDb } from '../db/db'
import { Candidate } from '../pipeline/stage1-resolve'
import { Profile } from '../types/profile'
import { CompanyResearch, RunEvent, StageName, TriageResult, type StageStatus } from '../types/research'
import { Pipeline, PipelineReason, PrepEntry, Round, RoundPatch, TrackingPatch } from '../types/tracking'
import { runSpend } from '../util/cost'

// Every function takes the owner and scopes its query by it. The server connects as a role that
// bypasses RLS, so this scoping is the primary guard; RLS is the second.

const SpendRow = z.object({ usd: z.number(), searches: z.int(), input: z.int(), output: z.int() })

export const RunRecord = z.object({
  id: z.string(),
  mode: z.enum(['triage', 'deep']),
  started_at: z.iso.datetime(),
  finished_at: z.iso.datetime().nullable(),
  status: z.enum(['running', 'needs_choice', 'done', 'failed']),
  cost_usd: z.number(),
  searches: z.int(),
  input_tokens: z.int(),
  output_tokens: z.int(),
  stages: z.partialRecord(StageName, SpendRow),
  error: z.string().nullable(),
})
export type RunRecord = z.infer<typeof RunRecord>

const Status = z.enum(['idle', 'running', 'needs_choice', 'done', 'failed'])

/** What the app reads: the opportunity, its runs with their cost, and the latest run's events. */
export const Opportunity = z.object({
  id: z.string(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  text: z.string(),
  company: z.string().nullable(),
  role: z.string().nullable(),
  domain: z.string().nullable(),
  status: Status,
  candidates: z.array(Candidate),
  choice_reason: z.string().nullable(),
  error: z.string().nullable(),
  events: z.array(RunEvent),
  triage: TriageResult.nullable(),
  report: CompanyResearch.nullable(),
  runs: z.array(RunRecord),
  pipeline: Pipeline,
  pipeline_reason: PipelineReason.nullable(),
  pipeline_at: z.iso.datetime(),
  notes: z.string(),
  next_step: z.string().nullable(),
  next_step_at: z.string().nullable(),
  prep: z.record(z.string(), PrepEntry),
  rounds: z.array(Round),
})
export type Opportunity = z.infer<typeof Opportunity>

/** Fields a caller may change directly. Validated before writing, so bad data never lands. */
const Patch = Opportunity.pick({ company: true, role: true, domain: true, status: true, candidates: true, choice_reason: true, error: true, triage: true, report: true }).partial()
type Patch = z.infer<typeof Patch>
const JSON_FIELDS = new Set(['candidates', 'triage', 'report'])

// A durable run is retried for minutes at most; one still "running" after this has stalled.
const STALL_MINUTES = 30

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : new Date(String(d)).toISOString())
const id = (bytes: number) => randomBytes(bytes).toString('hex')

export async function createOpportunity(owner: string, text: string): Promise<Opportunity> {
  if (!text.trim()) throw new Error('the pasted text is empty')
  const oppId = id(8)
  await (await getDb()).query('insert into opportunities (id, owner_id, text) values ($1, $2, $3)', [oppId, owner, text.trim()])
  return (await getOpportunity(owner, oppId))! // non-null: inserted just above
}

interface OppRow {
  id: string
  created_at: Date
  updated_at: Date
  text: string
  company: string | null
  role: string | null
  domain: string | null
  status: Opportunity['status']
  candidates: unknown
  choice_reason: string | null
  error: string | null
  triage: unknown
  report: unknown
  pipeline_at: Date
}
interface RunRow {
  id: string
  mode: 'triage' | 'deep'
  status: RunRecord['status']
  started_at: Date
  finished_at: Date | null
  error: string | null
  stalled: boolean
}

export async function getOpportunity(owner: string, oppId: string): Promise<Opportunity | null> {
  const db = await getDb()
  const [row] = await db.query<OppRow>('select * from opportunities where id = $1 and owner_id = $2', [oppId, owner])
  if (!row) return null
  const runs = await db.query<RunRow>(
    `select id, mode, status, started_at, finished_at, error,
            status = 'running' and started_at < now() - interval '${STALL_MINUTES} minutes' as stalled
       from runs where opportunity_id = $1 order by seq`,
    [oppId],
  )
  const latest = runs.at(-1)
  const events = latest
    ? await db.query<{ stage: StageName; status: RunEvent['status']; at: Date; output: unknown; error: string | null }>(
        'select stage, status, at, output, error from run_events where run_id = $1 order by id',
        [latest.id],
      )
    : []
  const records = await Promise.all(
    runs.map(async (r): Promise<RunRecord> => {
      const s = await runSpend(r.id)
      return {
        id: r.id,
        mode: r.mode,
        status: r.stalled ? 'failed' : r.status,
        started_at: iso(r.started_at),
        finished_at: r.finished_at ? iso(r.finished_at) : null,
        error: r.stalled ? 'Stalled: the run stopped reporting progress.' : r.error,
        cost_usd: s.usd,
        searches: s.searches,
        input_tokens: s.input + s.cacheRead + s.cacheWrite,
        output_tokens: s.output,
        stages: Object.fromEntries(
          Object.entries(s.stages).map(([k, v]) => [k, { usd: v.usd, searches: v.searches, input: v.input + v.cacheRead + v.cacheWrite, output: v.output }]),
        ),
      }
    }),
  )
  const rounds = await listRounds(owner, oppId)
  const stalled = row.status === 'running' && latest?.stalled
  return Opportunity.parse({
    ...row,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    pipeline_at: iso(row.pipeline_at),
    status: stalled ? 'failed' : row.status,
    error: stalled ? 'Research stalled and was stopped. Start it again.' : row.error,
    events: events.map((e) => ({ stage: e.stage, status: e.status, at: iso(e.at), ...(e.output != null && { output: e.output }), ...(e.error && { error: e.error }) })),
    runs: records,
    rounds,
  })
}

export async function listOpportunities(owner: string): Promise<Opportunity[]> {
  const ids = await (await getDb()).query<{ id: string }>('select id from opportunities where owner_id = $1 order by created_at desc', [owner])
  // shortcut: one read per opportunity; fine for a personal inbox. Move to a single summary query past a few hundred rows.
  return (await Promise.all(ids.map((r) => getOpportunity(owner, r.id)))).filter((o): o is Opportunity => o !== null)
}

export async function patchOpportunity(owner: string, oppId: string, patch: Patch): Promise<void> {
  const valid = Patch.parse(patch)
  const keys = Object.keys(valid) as (keyof Patch)[]
  const sets = keys.map((k, i) => `${k} = $${i + 3}${JSON_FIELDS.has(k) ? '::jsonb' : ''}`)
  const values = keys.map((k) => (JSON_FIELDS.has(k) ? JSON.stringify(valid[k]) : valid[k]))
  const rows = await (await getDb()).query(
    `update opportunities set ${[...sets, 'updated_at = now()'].join(', ')} where id = $1 and owner_id = $2 returning id`,
    [oppId, owner, ...values],
  )
  if (!rows.length) throw new Error(`no opportunity ${oppId}`)
}

/** Your own edits: stage, notes, next step, prep answers. Moving the stage stamps when, and drops a reason that no longer applies. */
export async function updateTracking(owner: string, oppId: string, patch: TrackingPatch): Promise<void> {
  const valid = TrackingPatch.parse(patch)
  const fields: Record<string, unknown> = { ...valid }
  if (valid.pipeline) fields.pipeline_reason = valid.pipeline_reason ?? null
  const keys = Object.keys(fields)
  if (!keys.length) return
  const sets = keys.map((k, i) => `${k} = $${i + 3}${k === 'prep' ? '::jsonb' : ''}`)
  if (valid.pipeline) sets.push('pipeline_at = now()')
  const values = keys.map((k) => (k === 'prep' ? JSON.stringify(fields[k]) : fields[k]))
  const rows = await (await getDb()).query(`update opportunities set ${[...sets, 'updated_at = now()'].join(', ')} where id = $1 and owner_id = $2 returning id`, [oppId, owner, ...values])
  if (!rows.length) throw new Error(`no opportunity ${oppId}`)
}

/** How many opportunities sit in each stage, for navigation. Stages with none are left out. */
export async function pipelineCounts(owner: string): Promise<Partial<Record<Pipeline, number>>> {
  const rows = await (await getDb()).query<{ pipeline: Pipeline; n: number }>('select pipeline, count(*)::int as n from opportunities where owner_id = $1 group by pipeline', [owner])
  return Object.fromEntries(rows.map((r) => [r.pipeline, r.n]))
}

/** Removes it with its runs and events. Spend rows stay (their run link is cleared), so the month's total does not shrink. */
export async function deleteOpportunity(owner: string, oppId: string): Promise<boolean> {
  const rows = await (await getDb()).query('delete from opportunities where id = $1 and owner_id = $2 returning id', [oppId, owner])
  return rows.length > 0
}

interface RoundRow {
  id: string
  kind: Round['kind']
  at: Date | null
  format: Round['format']
  interviewers: string[]
  notes: string
  outcome: Round['outcome']
  created_at: Date
}
const ROUND_COLUMNS = 'id, kind, at, format, interviewers, notes, outcome, created_at'
const toRound = (r: RoundRow): Round => Round.parse({ ...r, at: r.at ? iso(r.at) : null, created_at: iso(r.created_at) })

// The settable columns, in a fixed order; interviewers is a JSON array.
const ROUND_FIELDS = ['kind', 'at', 'format', 'interviewers', 'notes', 'outcome'] as const
const roundValue = (k: (typeof ROUND_FIELDS)[number], v: unknown) => (k === 'interviewers' ? JSON.stringify(v) : v)
const roundCast = (k: (typeof ROUND_FIELDS)[number]) => (k === 'interviewers' ? '::jsonb' : '')

/** Rounds in date order, unscheduled ones last. */
export async function listRounds(owner: string, oppId: string): Promise<Round[]> {
  const rows = await (await getDb()).query<RoundRow>(
    `select ${ROUND_COLUMNS} from rounds where opportunity_id = $1 and owner_id = $2 order by at nulls last, created_at`,
    [oppId, owner],
  )
  return rows.map(toRound)
}

export async function addRound(owner: string, oppId: string, input: RoundPatch & { kind: Round['kind'] }): Promise<Round> {
  const valid = RoundPatch.required({ kind: true }).parse(input)
  const db = await getDb()
  const mine = await db.query('select 1 from opportunities where id = $1 and owner_id = $2', [oppId, owner])
  if (!mine.length) throw new Error(`no opportunity ${oppId}`)
  const keys = ROUND_FIELDS.filter((k) => valid[k] !== undefined)
  const placeholders = keys.map((k, i) => `$${i + 4}${roundCast(k)}`)
  const [row] = await db.query<RoundRow>(
    `insert into rounds (id, opportunity_id, owner_id, ${keys.join(', ')}) values ($1, $2, $3, ${placeholders.join(', ')}) returning ${ROUND_COLUMNS}`,
    [id(6), oppId, owner, ...keys.map((k) => roundValue(k, valid[k]))],
  )
  return toRound(row!) // non-null: an insert with returning yields its row
}

export async function updateRound(owner: string, roundId: string, patch: RoundPatch): Promise<Round> {
  const valid = RoundPatch.parse(patch)
  const keys = ROUND_FIELDS.filter((k) => valid[k] !== undefined)
  const sets = keys.map((k, i) => `${k} = $${i + 3}${roundCast(k)}`)
  const [row] = await (await getDb()).query<RoundRow>(
    `update rounds set ${sets.join(', ') || 'id = id'} where id = $1 and owner_id = $2 returning ${ROUND_COLUMNS}`,
    [roundId, owner, ...keys.map((k) => roundValue(k, valid[k]))],
  )
  if (!row) throw new Error(`no round ${roundId}`)
  return toRound(row)
}

/** A round with the company and role it belongs to, for its calendar file. */
export async function roundWithOpportunity(owner: string, roundId: string): Promise<{ round: Round; opportunity_id: string; company: string | null; role: string | null } | null> {
  const [row] = await (await getDb()).query<RoundRow & { opportunity_id: string; company: string | null; role: string | null }>(
    `select r.id, r.kind, r.at, r.format, r.interviewers, r.notes, r.outcome, r.created_at, r.opportunity_id, o.company, o.role
       from rounds r join opportunities o on o.id = r.opportunity_id
      where r.id = $1 and r.owner_id = $2`,
    [roundId, owner],
  )
  if (!row) return null
  const { opportunity_id, company, role, ...r } = row
  return { round: toRound(r), opportunity_id, company, role }
}

export async function deleteRound(owner: string, roundId: string): Promise<boolean> {
  const rows = await (await getDb()).query('delete from rounds where id = $1 and owner_id = $2 returning id', [roundId, owner])
  return rows.length > 0
}

/** Starts a run record and marks the opportunity as running. */
export async function beginRun(owner: string, oppId: string, mode: 'triage' | 'deep'): Promise<string> {
  await patchOpportunity(owner, oppId, { status: 'running', error: null })
  const runId = id(6)
  await (await getDb()).query('insert into runs (id, opportunity_id, owner_id, mode) values ($1, $2, $3, $4)', [runId, oppId, owner, mode])
  return runId
}

export async function setWorkflowRunId(owner: string, runId: string, workflowRunId: string): Promise<void> {
  await (await getDb()).query('update runs set workflow_run_id = $3 where id = $1 and owner_id = $2', [runId, owner, workflowRunId])
}

/** Appends one progress event. A finished parse also fills in the company and role, so the inbox shows them early. */
export async function recordEvent(owner: string, oppId: string, runId: string, e: RunEvent): Promise<void> {
  const ev = RunEvent.parse(e)
  await (await getDb()).query(
    'insert into run_events (run_id, opportunity_id, owner_id, stage, status, at, output, error) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)',
    [runId, oppId, owner, ev.stage, ev.status, ev.at, ev.output === undefined ? null : JSON.stringify(ev.output), ev.error ?? null],
  )
  const out = ev.output as { company_name?: string | null; role?: { title?: string } } | undefined
  if (ev.stage === 'parse' && ev.status === 'ok' && out) {
    const patch: Patch = {}
    if (out.company_name) patch.company = out.company_name
    if (out.role?.title) patch.role = out.role.title
    if (Object.keys(patch).length) await patchOpportunity(owner, oppId, patch)
  }
}

/** Closes a run, and sets the opportunity's outcome (status plus any result fields) in the same breath. */
export async function finishRun(
  owner: string,
  oppId: string,
  runId: string,
  outcome: { status: Exclude<RunRecord['status'], 'running'>; error?: string } & Omit<Patch, 'status' | 'error'>,
): Promise<void> {
  const { status, error, ...rest } = outcome
  await (await getDb()).query('update runs set status = $3, error = $4, finished_at = now() where id = $1 and owner_id = $2', [runId, owner, status, error ?? null])
  await patchOpportunity(owner, oppId, { ...rest, status, error: error ?? null })
}

export async function getProfile(owner: string): Promise<Profile | null> {
  const [row] = await (await getDb()).query<{ data: unknown }>('select data from profiles where owner_id = $1', [owner])
  return row ? Profile.parse(row.data) : null
}

export async function saveProfile(owner: string, data: unknown): Promise<Profile> {
  const p = Profile.parse(data)
  await (await getDb()).query(
    'insert into profiles (owner_id, data) values ($1, $2::jsonb) on conflict (owner_id) do update set data = excluded.data, updated_at = now()',
    [owner, JSON.stringify(p)],
  )
  return p
}

