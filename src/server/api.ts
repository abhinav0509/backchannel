import { start } from 'workflow/api'
import { z } from 'zod'
import { message } from '../pipeline/run'
import { toMarkdown, triageToMarkdown } from '../report/markdown'
import * as repo from '../store/repo'
import type { Opportunity } from '../store/repo'
import { Domain, type Flag, type ScoreDimension, type StageName } from '../types/research'
import { slug } from '../util/slug'
import { researchWorkflow, type Ctx } from '../workflows/research'

export interface Reply {
  status: number
  body: unknown
}
const reply = (status: number, body: unknown): Reply => ({ status, body })
const invalid = (e: z.ZodError) => reply(400, { error: e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') })
const notFound = () => reply(404, { error: 'No opportunity with that id.' })

const Mode = z.enum(['triage', 'deep'])
const CreateBody = z.object({ text: z.string().trim().min(1, 'paste the email or job description').max(60_000), mode: Mode })
const RunBody = z.object({ mode: Mode, companyDomain: Domain.optional() })

/** A row in the inbox. Scores keep their six parts: the PRD forbids one blended number. */
export interface Summary {
  id: string
  company: string | null
  role: string | null
  status: Opportunity['status']
  stage: StageName | null
  created_at: string
  updated_at: string
  depth: 'deep' | 'triage' | null
  recommendation: 'deep' | 'skip' | null
  headline: string | null
  scores: { dimension: ScoreDimension; value: number; unknown: boolean }[]
  flags: Pick<Flag, 'kind' | 'polarity' | 'severity' | 'title'>[]
  cost_usd: number
}

const firstSentence = (s: string) => s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s

function summarise(o: Opportunity): Summary {
  const flags = o.report?.flags ?? o.triage?.flags ?? []
  return {
    id: o.id,
    company: o.company,
    role: o.role,
    status: o.status,
    stage: o.status === 'running' ? (o.events.at(-1)?.stage ?? null) : null,
    created_at: o.created_at,
    updated_at: o.updated_at,
    depth: o.report ? 'deep' : o.triage ? 'triage' : null,
    recommendation: o.triage ? (o.triage.deep_dive.recommended ? 'deep' : 'skip') : null,
    headline: o.report ? firstSentence(o.report.verdict) : (o.triage?.deep_dive.reason ?? null),
    scores: (o.report?.scores ?? []).map(({ dimension, value, unknown }) => ({ dimension, value, unknown })),
    flags: [...flags]
      .sort((a, b) => (a.polarity === b.polarity ? b.severity - a.severity : a.polarity === 'risk' ? -1 : 1))
      .slice(0, 2)
      .map(({ kind, polarity, severity, title }) => ({ kind, polarity, severity, title })),
    cost_usd: o.runs.reduce((sum, r) => sum + r.cost_usd, 0),
  }
}

export const list = async (owner: string): Promise<Reply> => reply(200, (await repo.listOpportunities(owner)).map(summarise))

export async function get(owner: string, id: string): Promise<Reply> {
  const o = await repo.getOpportunity(owner, id)
  return o ? reply(200, o) : notFound()
}

/** Opens a run and hands it to the durable workflow. If the workflow cannot start, the run is marked failed. */
async function launch(owner: string, o: Opportunity, mode: 'triage' | 'deep', companyDomain?: string): Promise<Reply | null> {
  const runId = await repo.beginRun(owner, o.id, mode)
  const ctx: Ctx = { owner, oppId: o.id, runId, mode, text: o.text, ...(companyDomain && { companyDomain }) }
  try {
    const run = await start(researchWorkflow, [ctx])
    await repo.setWorkflowRunId(owner, runId, run.runId)
    return null
  } catch (e) {
    await repo.finishRun(owner, o.id, runId, { status: 'failed', error: `Could not start the research: ${message(e)}` })
    return reply(502, { error: 'Could not start the research. Try again in a moment.' })
  }
}

export async function create(owner: string, body: unknown): Promise<Reply> {
  const b = CreateBody.safeParse(body)
  if (!b.success) return invalid(b.error)
  const o = await repo.createOpportunity(owner, b.data.text)
  return (await launch(owner, o, b.data.mode)) ?? reply(201, { id: o.id })
}

export async function run(owner: string, id: string, body: unknown): Promise<Reply> {
  const o = await repo.getOpportunity(owner, id)
  if (!o) return notFound()
  const b = RunBody.safeParse(body)
  if (!b.success) return invalid(b.error)
  if (o.status === 'running') return reply(409, { error: 'Research is already running for this opportunity.' })
  return (await launch(owner, o, b.data.mode, b.data.companyDomain ?? o.domain ?? undefined)) ?? reply(202, { id })
}

export async function markdown(owner: string, id: string): Promise<Reply & { filename?: string }> {
  const o = await repo.getOpportunity(owner, id)
  if (!o?.report && !o?.triage) return reply(404, 'No report yet.')
  if (o.report) return { status: 200, body: toMarkdown(o.report), filename: `${slug(o.report.identity.display_name, o.report.role.title)}.md` }
  const t = o.triage! // non-null: one of report or triage exists, checked above
  return { status: 200, body: triageToMarkdown(t), filename: `${slug(t.identity.display_name, t.role.title)}.quick-check.md` }
}

export const getProfile = async (owner: string): Promise<Reply> => reply(200, await repo.getProfile(owner))

export async function saveProfile(owner: string, body: unknown): Promise<Reply> {
  try {
    return reply(200, await repo.saveProfile(owner, body))
  } catch (e) {
    if (e instanceof z.ZodError) return invalid(e)
    throw e
  }
}
