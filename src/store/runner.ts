import { randomBytes } from 'node:crypto'
import { runResearch } from '../pipeline/run.js'
import { loadProfile } from '../types/profile.js'
import type { RunEvent } from '../types/research.js'
import type { Budget } from '../util/cost.js'
import { getOpportunity, updateOpportunity, type Opportunity, type RunRecord } from './store.js'

// shortcut: runs execute inside the web server process and are tracked in memory, which works
// for one person on `next dev` / `next start`. Move to Inngest (PRD section 10) when hosted.
const active = new Map<string, Promise<void>>()
export const isActive = (id: string) => active.has(id)

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

function totals(budget: Budget): Pick<RunRecord, 'cost_usd' | 'searches' | 'input_tokens' | 'output_tokens' | 'stages'> {
  const t = budget.total
  return {
    cost_usd: Number(t.usd.toFixed(4)),
    searches: t.searches,
    input_tokens: t.input + t.cacheRead + t.cacheWrite,
    output_tokens: t.output,
    stages: Object.fromEntries(
      Object.entries(budget.stages).map(([k, s]) => [k, { usd: Number(s.usd.toFixed(4)), searches: s.searches, input: s.input + s.cacheRead + s.cacheWrite, output: s.output }]),
    ),
  }
}

function onEvent(id: string, e: RunEvent): void {
  updateOpportunity(id, (o) => {
    const out = e.output as { company_name?: string | null; role?: { title?: string } } | undefined
    const parsed = e.stage === 'parse' && e.status === 'ok' && out
    return {
      ...o,
      events: [...o.events, e],
      company: parsed && out.company_name ? out.company_name : o.company,
      role: parsed && out.role?.title ? out.role.title : o.role,
    }
  })
}

/** Starts a run in the background. Resolves when it finishes; never rejects for pipeline errors. */
export function startRun(id: string, opts: { mode: 'triage' | 'deep'; companyDomain?: string }): Promise<void> {
  if (active.has(id)) return Promise.reject(new Error('a run is already running for this opportunity'))
  const o = getOpportunity(id)
  if (!o) return Promise.reject(new Error(`no opportunity ${id}`))

  const runId = randomBytes(6).toString('hex')
  const companyDomain = opts.companyDomain ?? o.domain ?? undefined
  const finishRun = (patch: Partial<RunRecord>) => (r: RunRecord) => (r.id === runId ? { ...r, ...patch, finished_at: new Date().toISOString() } : r)

  updateOpportunity(id, (d) => ({
    ...d,
    status: 'running',
    runner_pid: process.pid,
    error: null,
    events: [],
    runs: [
      ...d.runs,
      { id: runId, mode: opts.mode, started_at: new Date().toISOString(), finished_at: null, status: 'running', cost_usd: 0, searches: 0, input_tokens: 0, output_tokens: 0, stages: {}, error: null },
    ],
  }))

  const work = (async () => {
    try {
      const outcome = await runResearch({ text: o.text, mode: opts.mode, profile: loadProfile(), companyDomain, onEvent: (e) => onEvent(id, e) })
      const t = totals(outcome.budget)
      if (outcome.kind === 'needs_choice') {
        updateOpportunity(id, (d) => ({ ...d, status: 'needs_choice', candidates: outcome.candidates, choice_reason: outcome.reason, runs: d.runs.map(finishRun({ ...t, status: 'needs_choice' })) }))
        return
      }
      const result = outcome.kind === 'triage' ? outcome.result : outcome.report
      updateOpportunity(id, (d) => ({
        ...d,
        status: 'done',
        candidates: [],
        choice_reason: null,
        domain: result.identity.domain,
        company: result.identity.display_name,
        ...(outcome.kind === 'triage' ? { triage: outcome.result } : { report: outcome.report }),
        runs: d.runs.map(finishRun({ ...t, status: 'done' })),
      }))
    } catch (e) {
      updateOpportunity(id, (d) => ({ ...d, status: 'failed', error: message(e), runs: d.runs.map(finishRun({ status: 'failed', error: message(e) })) }))
    } finally {
      active.delete(id)
    }
  })()
  active.set(id, work)
  return work
}

function alive(pid: number | null): boolean {
  if (pid === null) return false
  try {
    process.kill(pid, 0) // signal 0 only checks the process exists
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM' // exists, owned by someone else
  }
}

/** A run marked running whose process is gone (a restarted server, a killed CLI) was cut off. */
export function reconcile(o: Opportunity, running: (id: string) => boolean = isActive): Opportunity {
  const elsewhere = o.runner_pid !== null && o.runner_pid !== process.pid && alive(o.runner_pid)
  return o.status === 'running' && !running(o.id) && !elsewhere
    ? { ...o, status: 'failed', error: 'The run was interrupted because the server restarted. Start it again.' }
    : o
}
