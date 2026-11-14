'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { Summary } from '../../src/server/api'
import { PIPELINE, PIPELINE_GROUPS, type Pipeline } from '../../src/types/pipeline'
import { stageLabel } from '../_lib/format'
import { STAGE } from '../_lib/pipeline'
import { Monogram } from './Monogram'
import { NewResearch } from './NewResearch'
import { MenuItem, Popover } from './Popover'
import { Segmented } from './Segmented'
import { Signal } from './Signal'
import { StageDot, StagePicker } from './StagePicker'

type View = 'list' | 'board'

const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** "Panel on Nov 20", flagged when it has passed: the one date that should pull you back in. */
export function NextStep({ o, today, compact }: { o: Pick<Summary, 'next_step' | 'next_step_at'>; today: string; compact?: boolean }) {
  if (!o.next_step && !o.next_step_at) return null
  const overdue = !!o.next_step_at && o.next_step_at < today
  const isToday = o.next_step_at === today
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 t-micro ${overdue ? 'text-risk' : isToday ? 'text-accent' : 'text-ink-2'}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="shrink-0">
        <rect x="1.5" y="2.5" width="9" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1.5 5h9M4 1.5v2M8 1.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="truncate">
        {o.next_step && !compact ? `${o.next_step}${o.next_step_at ? ', ' : ''}` : ''}
        {o.next_step_at ? (isToday ? 'today' : shortDate(o.next_step_at)) : ''}
        {overdue && ' (passed)'}
      </span>
    </span>
  )
}

/** What the research says, in one line: running, waiting on you, stopped, or its headline. */
function ResearchLine({ o }: { o: Summary }) {
  if (o.status === 'running')
    return (
      <span className="flex items-center gap-2 t-small text-ink-2">
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/50" />
          <span className="relative h-2 w-2 rounded-full bg-accent" />
        </span>
        {o.stage ? stageLabel(o.stage) : 'Starting'}
      </span>
    )
  if (o.status === 'needs_choice') return <span className="t-small font-medium text-amber">Needs you: which company is this?</span>
  if (o.status === 'failed') return <span className="t-small text-risk">Research stopped. Open to retry.</span>
  if (!o.headline) return <span className="t-small text-ink-3">No research yet</span>
  return (
    <span className="line-clamp-2 t-small text-ink-2">
      {o.depth === 'triage' && (
        <span className={`mr-1 font-semibold ${o.recommendation === 'deep' ? 'text-accent' : 'text-ink-3'}`}>{o.recommendation === 'deep' ? 'Worth a closer look.' : 'Probably skip.'}</span>
      )}
      {o.headline}
    </span>
  )
}

function RowMenu({ o }: { o: Summary }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function remove(close: () => void) {
    const res = await fetch(`/api/opportunities/${o.id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) {
      setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not delete. Try again.')
      return
    }
    close()
    router.refresh()
  }
  return (
    <Popover
      label={`Actions for ${o.company ?? 'this opportunity'}`}
      align="end"
      width={248}
      trigger={(open) => (
        <span className={`grid h-8 w-8 place-items-center rounded-[9px] text-ink-3 transition-colors duration-100 hover:bg-sunken hover:text-ink ${open ? 'bg-sunken text-ink' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <circle cx="3.5" cy="8" r="1.3" fill="currentColor" />
            <circle cx="8" cy="8" r="1.3" fill="currentColor" />
            <circle cx="12.5" cy="8" r="1.3" fill="currentColor" />
          </svg>
        </span>
      )}
    >
      {(close) =>
        confirming ? (
          <div className="fill-in p-2">
            <p className="t-small font-semibold">Delete {o.company ?? 'this opportunity'}?</p>
            <p className="mt-0.5 t-micro text-ink-3">Its research, notes and prep go too. Spend already made still counts this month.</p>
            {error && <p className="mt-2 t-micro text-risk">{error}</p>}
            <div className="mt-3 flex justify-end gap-1.5">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
                Keep
              </button>
              <button type="button" className="btn btn-sm bg-risk text-white hover:opacity-90" onClick={() => void remove(close)}>
                Delete
              </button>
            </div>
          </div>
        ) : (
          <>
            <MenuItem onClick={() => router.push(`/o/${o.id}`)}>Open</MenuItem>
            <MenuItem onClick={() => router.push(`/o/${o.id}?tab=prep`)}>Interview prep</MenuItem>
            <div className="my-1 border-t border-line-soft" />
            <MenuItem tone="risk" disabled={o.status === 'running'} onClick={() => setConfirming(true)}>
              {o.status === 'running' ? 'Delete after research finishes' : 'Delete'}
            </MenuItem>
          </>
        )
      }
    </Popover>
  )
}

function Row({ o, today }: { o: Summary; today: string }) {
  return (
    <li className="group relative grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-[14px] px-3 py-3.5 transition-colors duration-100 hover:bg-surface md:grid-cols-[36px_minmax(0,14rem)_minmax(0,1fr)_56px_auto_32px]">
      <Monogram name={o.company} />
      <div className="min-w-0">
        <Link href={`/o/${o.id}`} className="block truncate font-semibold tracking-[-0.015em] after:absolute after:inset-0 after:rounded-[14px] after:content-['']">
          {o.company ?? 'Reading the email…'}
        </Link>
        <p className="truncate t-small text-ink-3">{o.role || (o.status === 'running' ? ' ' : 'Added by name')}</p>
      </div>
      <div className="col-span-3 col-start-1 row-start-2 min-w-0 md:col-span-1 md:col-start-3 md:row-start-1">
        <ResearchLine o={o} />
        <div className="mt-1">
          <NextStep o={o} today={today} />
        </div>
      </div>
      <div className="hidden md:block">
        <Signal scores={o.scores} />
      </div>
      <div className="relative z-10 col-start-3 row-start-1 flex items-center gap-1 md:col-start-5">
        <StagePicker id={o.id} stage={o.pipeline} reason={o.pipeline_reason} size="sm" />
        <span className="md:hidden">
          <RowMenu o={o} />
        </span>
      </div>
      <div className="relative z-10 hidden md:block">
        <RowMenu o={o} />
      </div>
    </li>
  )
}

function Card({ o, today }: { o: Summary; today: string }) {
  return (
    <li className="card group relative p-3.5 transition-shadow duration-150 hover:shadow-[0_0_0_1px_var(--line-strong),0_6px_16px_-8px_rgba(0,0,0,0.18)]">
      <div className="flex items-start gap-3">
        <Monogram name={o.company} size={30} />
        <div className="min-w-0 flex-1">
          <Link href={`/o/${o.id}`} className="block truncate t-small font-semibold after:absolute after:inset-0 after:rounded-[16px] after:content-['']">
            {o.company ?? 'Reading the email…'}
          </Link>
          <p className="truncate t-micro text-ink-3">{o.role || 'Added by name'}</p>
        </div>
        <Signal scores={o.scores} />
      </div>
      <div className="mt-3">
        <ResearchLine o={o} />
      </div>
      <div className="relative z-10 mt-3 flex items-center justify-between gap-2">
        <StagePicker id={o.id} stage={o.pipeline} reason={o.pipeline_reason} size="sm" align="start" />
        <NextStep o={o} today={today} compact />
      </div>
    </li>
  )
}

function Empty() {
  return (
    <section className="mx-auto max-w-[560px] pt-16 pb-10 text-center sm:pt-24">
      <div className="mx-auto mb-8 flex h-16 items-end justify-center gap-[6px]" aria-hidden>
        {[38, 62, 26, 100, 50, 72].map((h, i) => (
          <span key={i} className="rise w-[9px] rounded-[3px]" style={{ height: `${h}%`, background: i === 3 ? 'var(--accent)' : 'var(--line-strong)', animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      <h1 className="t-hero">Know the company before the first call.</h1>
      <p className="mx-auto mt-4 max-w-[42ch] t-lede text-ink-2">Paste what a recruiter sent, or name a company. Backchannel researches who owns it, who runs it, how it treats people and where it is heading, with a source behind every fact.</p>
      <div className="mx-auto mt-8 w-56">
        <NewResearch label="Research a company" />
      </div>
    </section>
  )
}

/** Your opportunities, by where they stand: a list grouped by stage, or a board across the pipeline. */
export function Inbox({ items, stage, view: initialView, today }: { items: Summary[]; stage: Pipeline | null; view: View; today: string }) {
  const router = useRouter()
  const [view, setView] = useState<View>(initialView)
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((o) => (!stage || o.pipeline === stage) && (!q || `${o.company ?? ''} ${o.role ?? ''} ${o.domain ?? ''}`.toLowerCase().includes(q)))
  }, [items, stage, query])

  if (!items.length) return <Empty />

  const title = stage ? STAGE[stage].label : 'All opportunities'
  const due = items.filter((o) => o.next_step_at && o.next_step_at <= today && !PIPELINE_GROUPS.closed.includes(o.pipeline as never)).length
  const groups = stage ? [stage] : PIPELINE.filter((p) => shown.some((o) => o.pipeline === p))
  const columns: readonly Pipeline[] = stage ? [stage] : [...PIPELINE_GROUPS.active, ...PIPELINE_GROUPS.parked]

  return (
    <div className="pt-8 lg:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-display">{title}</h1>
          <p className="mt-1 t-small text-ink-3">
            {shown.length} {shown.length === 1 ? 'company' : 'companies'}
            {stage && <span> {STAGE[stage].hint.toLowerCase()}</span>}
            {!stage && due > 0 && <span className="text-accent"> {due === 1 ? 'One next step is' : `${due} next steps are`} due</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative block">
            <span className="sr-only">Search opportunities</span>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">
              <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="m9.2 9.2 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="field h-9 w-40 py-0 pl-8 text-[14px] sm:w-52" />
          </label>
          <Segmented<View>
            value={view}
            onChange={(v) => {
              setView(v)
              const p = new URLSearchParams(window.location.search)
              if (v === 'board') p.set('view', 'board')
              else p.delete('view')
              router.replace(`/?${p.toString()}`, { scroll: false })
            }}
            options={[
              { value: 'list', label: 'List' },
              { value: 'board', label: 'Board' },
            ]}
          />
        </div>
      </header>

      {/* Phones have no sidebar: the stages scroll across the top instead. */}
      <nav aria-label="Stages" className="-mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden">
        {[null, ...PIPELINE].map((p) => {
          const n = p ? items.filter((o) => o.pipeline === p).length : items.length
          if (p && !n) return null
          return (
            <Link
              key={p ?? 'all'}
              href={p ? `/?stage=${p}` : '/'}
              className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-3 t-small font-medium ${stage === p ? 'bg-ink text-canvas' : 'bg-surface text-ink-2 shadow-[var(--shadow-1)]'}`}
            >
              {p && <StageDot stage={p} />}
              {p ? STAGE[p].label : 'All'}
              <span className="tabular-nums opacity-60">{n}</span>
            </Link>
          )
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="mt-16 text-center t-small text-ink-3">{query ? `Nothing matches “${query}”.` : `Nothing is ${STAGE[stage ?? 'new'].label.toLowerCase()} right now.`}</p>
      ) : view === 'list' ? (
        <div className="mt-8 space-y-8">
          {groups.map((g) => {
            const rows = shown.filter((o) => o.pipeline === g)
            return (
              <section key={g} aria-labelledby={`g-${g}`}>
                {!stage && (
                  <h2 id={`g-${g}`} className="flex items-center gap-2 px-3 pb-1.5 t-small font-semibold">
                    <StageDot stage={g} />
                    {STAGE[g].label}
                    <span className="font-normal tabular-nums text-ink-3">{rows.length}</span>
                  </h2>
                )}
                <ul className="-mx-3">
                  {rows.map((o) => (
                    <Row key={o.id} o={o} today={today} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="-mx-4 mt-8 overflow-x-auto px-4 pb-6 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <div className="flex gap-3">
            {columns.map((c) => {
              const cards = shown.filter((o) => o.pipeline === c)
              return (
                <section key={c} aria-labelledby={`col-${c}`} className="w-[272px] shrink-0">
                  <h2 id={`col-${c}`} className="flex items-center gap-2 px-1 pb-2.5 t-small font-semibold">
                    <StageDot stage={c} />
                    {STAGE[c].label}
                    <span className="font-normal tabular-nums text-ink-3">{cards.length}</span>
                  </h2>
                  <ul className="min-h-24 space-y-2 rounded-[16px] bg-sunken/60 p-2">
                    {cards.map((o) => (
                      <Card key={o.id} o={o} today={today} />
                    ))}
                    {!cards.length && <li className="px-2 py-6 text-center t-micro text-ink-3">{STAGE[c].hint}</li>}
                  </ul>
                </section>
              )
            })}
          </div>
        </div>
      )}
      <p className="mt-10 hidden t-micro text-ink-3 lg:block">
        Press <kbd className="rounded-[5px] bg-surface px-1.5 font-sans font-semibold shadow-[var(--shadow-1)]">N</kbd> to research a new company.
      </p>
    </div>
  )
}
