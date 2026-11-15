import type { RunTrace } from '../../src/store/repo'
import type { StageName } from '../../src/types/research'
import type { CallTrace } from '../../src/types/trace'

export interface StageRow {
  stage: StageName
  status: 'ok' | 'partial' | 'failed' | 'running'
  start: number // ms from the run's start
  end: number
  error: string | null
  calls: CallTrace[]
  usd: number
  searches: number
}

const ms = (iso: string) => Date.parse(iso)

/** A run as rows on one clock: when each stage started and ended, what it called, and what the guardrails caught. */
export function timeline(t: RunTrace) {
  const t0 = ms(t.run.started_at)
  const last = Math.max(t0, ...t.events.map((e) => ms(e.at)), ...(t.run.finished_at ? [ms(t.run.finished_at)] : []))
  const rows = new Map<StageName, StageRow>()
  for (const e of t.events) {
    const stage = e.stage as StageName
    const row = rows.get(stage) ?? { stage, status: 'running', start: ms(e.at) - t0, end: last - t0, error: null, calls: [], usd: t.run.stages[stage]?.usd ?? 0, searches: t.run.stages[stage]?.searches ?? 0 }
    if (e.status !== 'started') Object.assign(row, { status: e.status, end: ms(e.at) - t0, error: e.error })
    rows.set(stage, row)
  }
  for (const c of t.calls) rows.get(c.stage)?.calls.push(c)

  const search = t.calls.filter((c) => c.kind === 'search')
  const dropped = t.calls.flatMap((c) => c.detail.dropped)
  return {
    total: last - t0,
    rows: [...rows.values()].sort((a, b) => a.start - b.start),
    totals: {
      calls: t.calls.length,
      queries: search.reduce((n, c) => n + c.detail.queries.length, 0),
      found: search.reduce((n, c) => n + (c.detail.found ?? 0), 0),
      cited: search.reduce((n, c) => n + (c.detail.cited ?? 0), 0),
      retries: t.calls.filter((c) => c.kind === 'structured' && c.detail.outcome !== 'valid').length,
      removedCitations: dropped.filter((d) => d.startsWith('removed a citation')).length,
      droppedClaims: dropped.filter((d) => d.startsWith('dropped an unsourced claim')).length,
      suspect: search.reduce((n, c) => n + c.detail.suspect.length, 0),
      capped: search.filter((c) => c.detail.capped).length,
    },
  }
}

export function duration(msecs: number): string {
  const s = msecs / 1000
  if (s < 1) return `${s.toFixed(1)} s`
  if (s < 60) return `${Math.round(s)} s`
  const m = Math.floor(s / 60)
  const rest = Math.round(s - m * 60)
  return rest ? `${m} min ${rest} s` : `${m} min`
}

export const modelName = (id: string) => {
  const m = id.match(/^claude-(\w+)-(\d+)-(\d+)$/)
  return m ? `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}.${m[3]}` : id // non-null: groups exist when m matches
}
