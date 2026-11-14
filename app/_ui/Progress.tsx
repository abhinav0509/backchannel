'use client'

import { useEffect, useState } from 'react'
import type { Opportunity } from '../../src/store/repo'
import type { RunEvent, StageName } from '../../src/types/research'
import { ownershipLabel, stageLabel, stagesFor } from '../_lib/format'

type State = 'waiting' | 'running' | 'ok' | 'partial' | 'failed'

function Glyph({ state }: { state: State }) {
  if (state === 'running')
    return (
      <svg className="spinner" width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <circle cx="9" cy="9" r="7" fill="none" stroke="var(--line)" strokeWidth="2" />
        <path d="M9 2a7 7 0 0 1 7 7" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  if (state === 'ok')
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="fill-in">
        <circle cx="9" cy="9" r="9" fill="var(--green)" />
        <path d="m5.5 9.2 2.3 2.3 4.7-5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  if (state === 'partial' || state === 'failed')
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="fill-in">
        <circle cx="9" cy="9" r="9" fill={state === 'failed' ? 'var(--risk)' : 'var(--amber)'} />
        <path d="M9 5v5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="9" cy="12.8" r="1.1" fill="white" />
      </svg>
    )
  return <span className="block h-[18px] w-[18px] rounded-full border-2 border-line" aria-hidden />
}

/** What each finished stage found, in one line, so the run is readable while later stages work. */
function finding(e: RunEvent | undefined): string | null {
  if (!e?.output || (e.status !== 'ok' && e.status !== 'partial')) return null
  const out = e.output as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- stage outputs vary by stage
  switch (e.stage) {
    case 'parse':
      return [out.company_name, out.role?.title, out.role?.location].filter(Boolean).join(', ') || null
    case 'resolve':
      return out.identity ? `${out.identity.legal_name?.value ?? out.identity.display_name}, ${out.identity.hq?.value ?? 'HQ unknown'}` : `${out.candidates?.length ?? 0} possible companies`
    case 'money':
      return out.ownership_type ? `${ownershipLabel(out.ownership_type.value)}, ${out.funding_events?.length ?? 0} funding or ownership events` : 'Ownership not established'
    case 'people': {
      const n = out.layoff_events?.length ?? 0
      return `${n === 0 ? 'No layoffs found' : `${n} layoff ${n === 1 ? 'event' : 'events'}`}, ${out.review_scores?.length ?? 0} review scores`
    }
    case 'business':
      return out.summary?.value ?? (out.founders?.length ? `${out.founders.length} founders found` : 'What they do not established')
    case 'market':
      return out.ai_summary?.value ?? `${out.recent_news?.length ?? 0} news items, ${out.ai_initiatives?.length ?? 0} AI initiatives`
    case 'contacts': {
      const n = out.contacts?.length ?? 0
      return n ? `${n} ${n === 1 ? 'person' : 'people'} found` : 'Nobody tied to the role found'
    }
    case 'press':
      return `${out.coverage?.length ?? 0} articles, ${out.own?.length ?? 0} of their own posts`
    case 'triage':
      return out.deep_dive?.reason ?? null
    default:
      return null
  }
}

export function Progress({ o }: { o: Opportunity }) {
  const run = o.runs.at(-1)
  // The clock starts after mount: reading Date.now() during render would differ between server and client.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const latest = new Map<StageName, RunEvent>()
  for (const e of o.events) latest.set(e.stage, e)
  const secs = run && now ? Math.max(0, Math.floor((now - new Date(run.started_at).getTime()) / 1000)) : null
  const stages = stagesFor(run?.mode ?? 'triage')

  return (
    <section aria-live="polite" className="card mb-10 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{run?.mode === 'deep' ? 'Researching in depth' : 'Running a quick check'}</h2>
        <span className="t-small tabular-nums text-ink-3">{secs !== null && `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</span>
      </div>
      <ol className="mt-5 space-y-4">
        {stages.map((s) => {
          const e = latest.get(s)
          const state: State = !e ? 'waiting' : e.status === 'started' ? 'running' : e.status
          const found = finding(e)
          return (
            <li key={s} className="grid grid-cols-[18px_1fr] gap-x-3">
              <span className="mt-[3px]">
                <Glyph state={state} />
              </span>
              <div>
                <p className={`t-small ${state === 'waiting' ? 'text-ink-3' : 'font-medium text-ink'}`}>{stageLabel(s)}</p>
                {found && <p className="fill-in t-small text-ink-2">{found}</p>}
                {e?.status === 'failed' && <p className="fill-in t-small text-risk">{e.error}</p>}
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-6 t-micro text-ink-3">You can leave this page. Research keeps running and the result will be in your opportunities.</p>
    </section>
  )
}
