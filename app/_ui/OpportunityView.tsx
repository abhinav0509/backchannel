'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { Opportunity } from '../../src/store/repo'
import { age, usd } from '../_lib/format'
import { sourceIndex } from '../_lib/sources'
import { supabaseBrowser } from '../_lib/supabase-browser'
import { Choice } from './Choice'
import { CompanyReport } from './CompanyReport'
import { Decision } from './Decision'
import { SourcesContext } from './Evidence'
import { Progress } from './Progress'
import { RunView } from './RunView'
import { Segmented } from './Segmented'
import { TriageView } from './TriageView'

type Tab = 'decision' | 'company' | 'run'

/**
 * Keeps the page current while research runs, so each section fills in the moment its stage
 * finishes. With Supabase, new run events arrive over Realtime and a slow poll is only a safety
 * net; locally it polls.
 */
function useLive(initial: Opportunity, realtime: boolean) {
  const [o, setO] = useState(initial)
  useEffect(() => {
    if (o.status !== 'running') return
    const refresh = async () => {
      const res = await fetch(`/api/opportunities/${o.id}`, { cache: 'no-store' })
      if (res.ok) setO((await res.json()) as Opportunity)
    }
    const supabase = realtime ? supabaseBrowser() : null
    const channel = supabase
      ?.channel(`run-events-${o.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'run_events', filter: `opportunity_id=eq.${o.id}` }, () => void refresh())
      .subscribe()
    const t = setInterval(refresh, supabase ? 8000 : 1200)
    return () => {
      clearInterval(t)
      if (channel) void supabase?.removeChannel(channel)
    }
  }, [o.id, o.status])
  return [o, setO] as const
}

export function OpportunityView({ initial, realtime }: { initial: Opportunity; realtime: boolean }) {
  const [o, setO] = useLive(initial, realtime)
  const [tab, setTab] = useState<Tab>('decision')
  const [startError, setStartError] = useState<string | null>(null)
  const index = useMemo(() => sourceIndex(o.report ?? o.triage), [o.report, o.triage])
  const totalCost = o.runs.reduce((s, r) => s + r.cost_usd, 0)
  const name = o.report?.identity.display_name ?? o.triage?.identity.display_name ?? o.company
  const domain = o.report?.identity.domain ?? o.triage?.identity.domain ?? o.domain

  async function start(mode: 'triage' | 'deep', companyDomain?: string) {
    setStartError(null)
    const res = await fetch(`/api/opportunities/${o.id}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(companyDomain ? { mode, companyDomain } : { mode }),
    })
    if (!res.ok) {
      setStartError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not start the research.')
      return
    }
    const fresh = await fetch(`/api/opportunities/${o.id}`, { cache: 'no-store' })
    if (fresh.ok) setO((await fresh.json()) as Opportunity)
  }

  const lastMode = o.runs.at(-1)?.mode ?? 'triage'

  return (
    <SourcesContext.Provider value={index}>
      <article className="pt-8">
        <Link href="/" className="inline-flex items-center gap-1 rounded-md t-small text-accent hover:underline">
          <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden className="mr-0.5">
            <path d="M6.5 1.5 1.5 6.5l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Opportunities
        </Link>

        <header className="mt-6 pb-8">
          <h1 className="t-display">{name ?? 'New opportunity'}</h1>
          <p className="t-lede mt-1 text-ink-2">{o.role ?? (o.status === 'running' ? 'Reading the email…' : 'Role not stated')}</p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 t-small text-ink-3">
            {domain && (
              <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="hover:text-accent">
                {domain}
              </a>
            )}
            <span suppressHydrationWarning>Added {age(o.created_at).toLowerCase()}</span>
            {totalCost > 0 && <span className="tabular-nums">Research cost {usd(totalCost)}</span>}
          </p>
        </header>

        {startError && <p className="mb-6 rounded-xl bg-risk-soft px-4 py-3 t-small text-risk">{startError}</p>}

        {o.status === 'running' && <Progress o={o} />}

        {o.status === 'needs_choice' && <Choice o={o} onChoose={(d) => void start(lastMode, d)} />}

        {o.status === 'failed' && (
          <div className="mb-10 rounded-2xl border border-line-soft bg-surface p-5">
            <p className="font-semibold">Research stopped</p>
            <p className="mt-1 t-small whitespace-pre-line text-ink-2">{o.error}</p>
            <button className="btn btn-primary mt-4" onClick={() => void start(lastMode)}>
              Try again
            </button>
          </div>
        )}

        {o.report ? (
          <>
            <div className="sticky top-12 z-10 -mx-5 mb-8 bg-canvas/85 px-5 py-3 backdrop-blur-xl">
              <Segmented<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'decision', label: 'Decision' },
                  { value: 'company', label: 'Company' },
                  { value: 'run', label: 'Sources' },
                ]}
              />
            </div>
            <div key={tab} className="fill-in">
              {tab === 'decision' && <Decision r={o.report} />}
              {tab === 'company' && <CompanyReport r={o.report} />}
              {tab === 'run' && <RunView o={o} />}
            </div>
          </>
        ) : (
          o.triage && <TriageView t={o.triage} running={o.status === 'running'} onDeep={() => void start('deep')} />
        )}

        {(o.report || o.triage) && (
          <footer className="mt-16 flex flex-wrap items-center gap-3 border-t border-line-soft pt-6">
            <a className="btn btn-quiet" href={`/api/opportunities/${o.id}/report`}>
              Download report
            </a>
            {o.report && o.status !== 'running' && (
              <button className="btn btn-quiet" onClick={() => void start('deep')}>
                Research again
              </button>
            )}
            <span className="t-micro text-ink-3" suppressHydrationWarning>
              Researched {age((o.report ?? o.triage)!.generated_at).toLowerCase()}. Companies change; re-run before each interview round.
            </span>
          </footer>
        )}

        <details className="group mt-10">
          <summary className="cursor-pointer list-none t-small text-ink-3 hover:text-ink-2">
            <span className="inline-block transition-transform duration-200 group-open:rotate-90">›</span> What the recruiter sent
          </summary>
          <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-sunken p-5 font-sans t-small text-ink-2">{o.text}</pre>
        </details>
      </article>
    </SourcesContext.Provider>
  )
}
