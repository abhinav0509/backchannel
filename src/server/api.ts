import { z } from 'zod'
import { reconcile, isActive, startRun } from '../store/runner.js'
import { createOpportunity, getOpportunity, listOpportunities, type Opportunity } from '../store/store.js'
import { toMarkdown, triageToMarkdown } from '../report/markdown.js'
import { Domain, type Flag, type ScoreDimension, type StageName } from '../types/research.js'
import { slug } from '../util/slug.js'

export interface Reply {
  status: number
  body: unknown
}
const reply = (status: number, body: unknown): Reply => ({ status, body })
const invalid = (e: z.ZodError) => reply(400, { error: e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') })

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

function summarise(raw: Opportunity): Summary {
  const o = reconcile(raw, isActive)
  const flags = o.report?.flags ?? o.triage?.flags ?? []
  const top = [...flags]
    .sort((a, b) => (a.polarity === b.polarity ? b.severity - a.severity : a.polarity === 'risk' ? -1 : 1))
    .slice(0, 2)
    .map(({ kind, polarity, severity, title }) => ({ kind, polarity, severity, title }))
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
    flags: top,
    cost_usd: o.runs.reduce((sum, r) => sum + r.cost_usd, 0),
  }
}

export const list = (): Reply => reply(200, listOpportunities().map(summarise))

export function get(id: string): Reply {
  const o = getOpportunity(id)
  return o ? reply(200, reconcile(o, isActive)) : reply(404, { error: 'No opportunity with that id.' })
}

export async function create(body: unknown): Promise<Reply> {
  const b = CreateBody.safeParse(body)
  if (!b.success) return invalid(b.error)
  const o = createOpportunity(b.data.text)
  void startRun(o.id, { mode: b.data.mode })
  return reply(201, { id: o.id })
}

export async function run(id: string, body: unknown): Promise<Reply> {
  if (!getOpportunity(id)) return reply(404, { error: 'No opportunity with that id.' })
  const b = RunBody.safeParse(body)
  if (!b.success) return invalid(b.error)
  if (isActive(id)) return reply(409, { error: 'Research is already running for this opportunity.' })
  void startRun(id, b.data.companyDomain ? { mode: b.data.mode, companyDomain: b.data.companyDomain } : { mode: b.data.mode })
  return reply(202, { id })
}

export function markdown(id: string): Reply & { filename?: string } {
  const o = getOpportunity(id)
  const r = o?.report ?? o?.triage
  if (!o || !r) return reply(404, 'No report yet.')
  const name = slug(r.identity.display_name, r.role.title)
  return o.report
    ? { status: 200, body: toMarkdown(o.report), filename: `${name}.md` }
    : { status: 200, body: triageToMarkdown(o.triage!), filename: `${name}.quick-check.md` } // non-null: r is the triage here
}
