'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Opportunity } from '../../src/store/repo'
import { age, usd } from '../_lib/format'
import { sourceIndex } from '../_lib/sources'
import { TABS, type Tab } from '../_lib/tabs'
import { supabaseBrowser } from '../_lib/supabase-browser'
import { Button, Spinner } from './Button'
import { Choice } from './Choice'
import { SourcesContext } from './Evidence'
import { Monogram } from './Monogram'
import { MenuItem, Popover } from './Popover'
import { Progress } from './Progress'
import { Brief } from './report/Brief'
import { Prep } from './report/Prep'
import { AiTab, CompanyTab, MoneyTab, OutlookTab, PeopleTab, PressTab } from './report/tabs'
import { Rounds } from './report/Rounds'
import { Tracker } from './report/Tracker'
import { RunView } from './RunView'
import { StagePicker } from './StagePicker'
import { SkeletonLines } from './TaskProgress'
import { TriageView } from './TriageView'

const LABEL: Record<Tab, string> = {
  brief: 'Brief',
  company: 'What they do',
  people: 'Founders & people',
  money: 'Money',
  ai: 'AI',
  outlook: 'Outlook',
  press: 'In the press',
  prep: 'Prep',
  sources: 'Sources',
}

/**
 * Keeps the page current while research runs, so each section fills in the moment its stage
 * finishes. With Supabase, new run events arrive over Realtime and a slow poll is only a safety
 * net; otherwise it polls.
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
    const t = setInterval(refresh, supabase ? 8000 : 1500)
    return () => {
      clearInterval(t)
      if (channel) void supabase?.removeChannel(channel)
    }
  }, [o.id, o.status, realtime])
  return [o, setO] as const
}

/** Tabs with an underline that slides to the selection. Arrow keys move between them. */
function TabBar({ tabs, value, onChange, badge }: { tabs: readonly Tab[]; value: Tab; onChange: (t: Tab) => void; badge: Partial<Record<Tab, string>> }) {
  const refs = useRef(new Map<Tab, HTMLButtonElement>())
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const el = refs.current.get(value)
    if (el) {
      setBar({ left: el.offsetLeft, width: el.offsetWidth })
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [value, tabs])
  return (
    <div role="tablist" aria-label="Report sections" className="relative -mx-1 flex overflow-x-auto px-1 [scrollbar-width:none]">
      {tabs.map((t) => (
        <button
          key={t}
          ref={(el) => {
            if (el) refs.current.set(t, el)
          }}
          role="tab"
          id={`tab-${t}`}
          aria-selected={t === value}
          aria-controls="tab-panel"
          tabIndex={t === value ? 0 : -1}
          onClick={() => onChange(t)}
          onKeyDown={(e) => {
            const i = tabs.indexOf(value)
            const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : null
            if (next) {
              onChange(next)
              refs.current.get(next)?.focus()
            }
          }}
          className={`relative flex h-11 shrink-0 items-center gap-1.5 px-3 t-small font-semibold whitespace-nowrap transition-colors duration-150 ${t === value ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}
        >
          {LABEL[t]}
          {badge[t] && <span className="rounded-full bg-sunken px-1.5 text-[11px] tabular-nums text-ink-3">{badge[t]}</span>}
        </button>
      ))}
      {bar && <span aria-hidden className="absolute bottom-0 h-[2px] rounded-full bg-ink transition-[left,width] duration-200 ease-[var(--ease-out)]" style={{ left: bar.left + 10, width: bar.width - 20 }} />}
    </div>
  )
}

export function OpportunityView({ initial, realtime, tab: initialTab, hasProfile }: { initial: Opportunity; realtime: boolean; tab: Tab | null; hasProfile: boolean }) {
  const router = useRouter()
  const [o, setO] = useLive(initial, realtime)
  const [startError, setStartError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const r = o.report
  const t = o.triage
  const index = useMemo(() => sourceIndex(r ?? t), [r, t])
  const totalCost = o.runs.reduce((s, x) => s + x.cost_usd, 0)
  const name = r?.identity.display_name ?? t?.identity.display_name ?? o.company
  const domain = r?.identity.domain ?? t?.identity.domain ?? o.domain
  const role = r?.role.title || t?.role.title || o.role
  const running = o.status === 'running'
  const lastMode = o.runs.at(-1)?.mode ?? 'triage'

  const tabs: readonly Tab[] = r ? TABS : t ? ['brief', 'sources'] : []
  const [tab, setTab] = useState<Tab>(initialTab && tabs.includes(initialTab) ? initialTab : 'brief')
  const choose = (next: Tab) => {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === 'brief') url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url)
  }

  // Which research is being started, so the button that started it can show it is working.
  const [starting, setStarting] = useState<'triage' | 'deep' | null>(null)

  async function start(mode: 'triage' | 'deep', companyDomain?: string) {
    if (starting) return
    setStartError(null)
    setStarting(mode)
    try {
      const res = await fetch(`/api/opportunities/${o.id}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(companyDomain ? { mode, companyDomain } : { mode }),
      }).catch(() => null)
      if (!res?.ok) {
        setStartError(((await res?.json().catch(() => ({}))) as { error?: string } | undefined)?.error ?? 'Could not start the research. Check your connection and try again.')
        return
      }
      const fresh = await fetch(`/api/opportunities/${o.id}`, { cache: 'no-store' })
      if (fresh.ok) setO((await fresh.json()) as Opportunity)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setStarting(null)
    }
  }

  /** Re-judges the report against your profile. Returns an error to show, or null when it worked. */
  async function refit(): Promise<string | null> {
    const res = await fetch(`/api/opportunities/${o.id}/refit`, { method: 'POST' }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as (Opportunity & { error?: string }) | null
    if (!res?.ok || !body || body.error) return body?.error ?? 'The refresh did not complete. Try again in a moment.'
    setO(body)
    router.refresh() // the sidebar's spend meter includes what this cost
    return null
  }

  async function remove(close: () => void) {
    setDeleting(true)
    const res = await fetch(`/api/opportunities/${o.id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) {
      setDeleting(false)
      setStartError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not delete. Try again.')
      close()
      return
    }
    router.push('/')
    router.refresh()
  }

  const deep = { onDeep: () => void start('deep'), running, starting: starting === 'deep' }
  // Older reports only have the question text; they show without a why, under one topic.
  const questions = r ? (r.questions.length ? r.questions : r.questions_to_ask.map((q) => ({ question: q, why: '', topic: 'company' as const }))) : []
  // Names to suggest as interviewers: the people research found.
  const people = [...new Set([...(r?.contacts ?? []).map((c) => c.value.name), ...(r?.business?.leaders ?? []).map((l) => l.value.name)])]
  const askedCount = r ? r.questions.filter((q) => o.prep[q.question]?.asked).length : 0

  return (
    <SourcesContext.Provider value={index}>
      <article className="pt-6 lg:pt-8">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-md t-small font-medium text-ink-3 hover:text-ink">
          <svg width="7" height="12" viewBox="0 0 7 12" aria-hidden>
            <path d="M5.5 1.5 1.5 6l4 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Opportunities
        </Link>

        <header className="mt-5 flex flex-wrap items-start gap-x-5 gap-y-4">
          <Monogram name={name} size={56} />
          <div className="min-w-0 flex-1 basis-64">
            <h1 className="t-display">{name ?? 'New opportunity'}</h1>
            <p className="mt-1 text-ink-2">{role || (running ? 'Reading the email…' : o.text.startsWith('Research this company.') ? 'No specific role yet' : 'Role not stated')}</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 t-micro text-ink-3">
              {domain && (
                <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="hover:text-accent">
                  {domain}
                </a>
              )}
              <span suppressHydrationWarning>Added {age(o.created_at).toLowerCase()}</span>
              {(r ?? t) && <span suppressHydrationWarning>Researched {age((r ?? t)!.generated_at).toLowerCase()}</span>}
              {totalCost > 0 && <span>Cost {usd(totalCost)}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StagePicker id={o.id} stage={o.pipeline} reason={o.pipeline_reason} onChange={(pipeline, pipeline_reason) => setO((x) => ({ ...x, pipeline, pipeline_reason }))} />
            <Popover
              label="More actions"
              align="end"
              width={260}
              trigger={(open) => (
                <span className={`grid h-9 w-9 place-items-center rounded-[10px] bg-surface text-ink-2 shadow-[var(--shadow-1)] transition-colors duration-100 hover:text-ink ${open ? 'text-ink' : ''}`}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                    <circle cx="3.5" cy="8" r="1.3" fill="currentColor" />
                    <circle cx="8" cy="8" r="1.3" fill="currentColor" />
                    <circle cx="12.5" cy="8" r="1.3" fill="currentColor" />
                  </svg>
                </span>
              )}
            >
              {(close) =>
                confirmDelete ? (
                  <div className="fill-in p-2">
                    <p className="t-small font-semibold">Delete {name ?? 'this opportunity'}?</p>
                    <p className="mt-0.5 t-micro text-ink-3">Its research, notes and prep go too.</p>
                    <div className="mt-3 flex justify-end gap-1.5">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
                        Keep
                      </button>
                      <Button type="button" className="btn-sm bg-risk text-white hover:opacity-90" pending={deleting} pendingLabel="Deleting" onClick={() => void remove(close)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <MenuItem disabled={running} onClick={() => (close(), void start('deep'))}>
                      {r ? 'Research again' : 'Run full research'}
                    </MenuItem>
                    {!r && (
                      <MenuItem disabled={running} onClick={() => (close(), void start('triage'))}>
                        Run a quick check again
                      </MenuItem>
                    )}
                    {(r || t) && (
                      <MenuItem onClick={() => (close(), (window.location.href = `/api/opportunities/${o.id}/report`))}>Download report</MenuItem>
                    )}
                    <div className="my-1 border-t border-line-soft" />
                    <MenuItem tone="risk" disabled={running} onClick={() => setConfirmDelete(true)}>
                      {running ? 'Delete after research finishes' : 'Delete'}
                    </MenuItem>
                  </>
                )
              }
            </Popover>
          </div>
        </header>

        {startError && (
          <p className="fill-in mt-6 rounded-[12px] bg-risk-soft px-4 py-3 t-small text-risk" role="alert">
            {startError}
          </p>
        )}
        {starting && !running && (
          <p className="fill-in mt-6 flex items-center gap-2.5 rounded-[12px] bg-accent-soft px-4 py-3 t-small font-medium text-accent" role="status">
            <Spinner />
            Starting {starting === 'deep' ? 'full research' : 'a quick check'}
          </p>
        )}

        {(running || o.status === 'needs_choice' || o.status === 'failed') && (
          <div className="mt-8">
            {running && <Progress o={o} />}
            {o.status === 'needs_choice' && <Choice o={o} onChoose={(d) => void start(lastMode, d)} />}
            {o.status === 'failed' && (
              <div className="card mb-10 p-5">
                <p className="font-semibold">Research stopped</p>
                <p className="mt-1 t-small whitespace-pre-line text-ink-2">{o.error}</p>
                <Button className="btn-primary mt-4" pending={starting !== null} pendingLabel="Starting" onClick={() => void start(lastMode)}>
                  Try again
                </Button>
              </div>
            )}
          </div>
        )}

        {/* First research: show the shape of the report to come, rather than an empty page. */}
        {running && !r && !t && <ReportPreview />}

        {tabs.length > 0 && (
          <>
            <div className="sticky top-14 z-20 -mx-4 mt-8 border-b border-line-soft bg-canvas/85 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
              <TabBar tabs={tabs} value={tab} onChange={choose} badge={{ press: r?.press ? String(r.press.coverage.length + r.press.own.length) : undefined, prep: r?.questions.length ? `${askedCount}/${r.questions.length}` : undefined, sources: index.size ? String(index.size) : undefined }} />
            </div>

            <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab} className="fill-in pt-8">
              {tab === 'brief' && (
                <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0">{r ? <Brief r={r} hasProfile={hasProfile} onRefit={running ? undefined : refit} /> : t && <TriageView t={t} running={running} starting={starting === 'deep'} onDeep={() => void start('deep')} />}</div>
                  <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
                    <Tracker id={o.id} initial={{ notes: o.notes, next_step: o.next_step, next_step_at: o.next_step_at }} />
                    <Rounds oppId={o.id} initial={o.rounds} questions={questions} prep={o.prep} people={people} />
                  </aside>
                </div>
              )}
              {r && tab === 'company' && <CompanyTab r={r} {...deep} />}
              {r && tab === 'people' && <PeopleTab r={r} {...deep} />}
              {r && tab === 'money' && <MoneyTab r={r} />}
              {r && tab === 'ai' && <AiTab r={r} {...deep} />}
              {r && tab === 'outlook' && <OutlookTab r={r} {...deep} />}
              {r && tab === 'press' && <PressTab r={r} {...deep} />}
              {r && tab === 'prep' && (
                <Prep
                  id={o.id}
                  questions={questions}
                  gaps={r.gaps}
                  initial={o.prep}
                  onChange={(prep) => setO((x) => ({ ...x, prep }))}
                  talkingPoints={r.fit?.talking_points ?? []}
                />
              )}
              {tab === 'sources' && <RunView o={o} />}
            </div>
          </>
        )}

        {!tabs.length && !running && (
          <div className="mt-8">
            <div className="grid gap-3 md:grid-cols-2">
              <Tracker id={o.id} initial={{ notes: o.notes, next_step: o.next_step, next_step_at: o.next_step_at }} />
              <Rounds oppId={o.id} initial={o.rounds} questions={questions} prep={o.prep} people={people} />
            </div>
          </div>
        )}

        <details className="group mt-16">
          <summary className="cursor-pointer list-none t-small text-ink-3 hover:text-ink-2">
            <span className="mr-1 inline-block transition-transform duration-200 group-open:rotate-90">›</span> {o.text.startsWith('Research this company.') ? 'How it was added' : 'What the recruiter sent'}
          </summary>
          <pre className="mt-3 rounded-[14px] bg-sunken p-5 font-sans t-small whitespace-pre-wrap text-ink-2">{o.text}</pre>
        </details>
      </article>
    </SourcesContext.Provider>
  )
}

/** The Brief's layout as placeholders, shown under the progress panel while a first research runs. */
function ReportPreview() {
  return (
    <div className="mt-2 grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]" aria-hidden>
      <div className="space-y-10">
        <div className="space-y-3">
          <span className="skeleton block h-6 w-4/5" />
          <span className="skeleton block h-6 w-3/5" />
          <span className="mt-4 block">
            <SkeletonLines lines={3} />
          </span>
        </div>
        <div className="card p-5">
          <span className="skeleton block h-3 w-20" />
          <div className="mt-5 grid grid-cols-6 gap-3">
            {[60, 85, 40, 70, 55, 30].map((h, i) => (
              <span key={i} className="flex h-24 flex-col justify-end rounded-[6px] bg-sunken">
                <span className="skeleton block rounded-[6px]" style={{ height: `${h}%` }} />
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="card p-4">
              <span className="skeleton block h-3 w-28" />
              <span className="mt-3 block">
                <SkeletonLines lines={3} widths={['90%', '75%', '50%']} />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="card hidden p-5 xl:block">
        <span className="skeleton block h-3 w-20" />
        <span className="mt-4 block">
          <SkeletonLines lines={4} widths={['100%', '100%', '70%', '40%']} />
        </span>
      </div>
    </div>
  )
}
