'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ROUND_LABEL } from '../../src/report/ics'
import type { AgendaItem } from '../../src/server/agenda'
import type { Round } from '../../src/types/tracking'
import { Monogram } from './Monogram'
import { Button } from './Button'

const STALE_DAYS = 7

const when = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  const day = d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === tomorrow.toDateString() ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'long' })
  return `${day}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function Upcoming({ x }: { x: AgendaItem }) {
  const router = useRouter()
  const [refresh, setRefresh] = useState<'idle' | 'busy' | 'started' | { error: string }>('idle')
  const stale = x.research_days !== null && x.research_days >= STALE_DAYS
  return (
    <li className="card flex flex-wrap items-center gap-4 p-4">
      <Monogram name={x.opportunity.company} size={36} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {ROUND_LABEL[x.round.kind]} at {x.opportunity.company ?? 'this company'}
        </p>
        <p className="t-small text-ink-2" suppressHydrationWarning>
          {when(x.round.at!)}
          {/* non-null: the agenda lists scheduled rounds only */}
          {x.round.interviewers.length > 0 && <span className="text-ink-3">, with {x.round.interviewers.join(', ')}</span>}
        </p>
        {stale && refresh !== 'started' && (
          <p className="mt-1 t-micro text-amber">
            Research is {x.research_days} days old. Things may have changed since.
          </p>
        )}
        {refresh === 'started' && <p className="mt-1 t-micro text-green">Research is running. It will show what changed.</p>}
        {typeof refresh === 'object' && <p className="mt-1 t-micro text-risk">{refresh.error}</p>}
      </div>
      <div className="flex items-center gap-2">
        {stale && refresh !== 'started' && (
          <Button
            type="button"
            className="btn-quiet btn-sm"
            pending={refresh === 'busy'}
            pendingLabel="Starting"
            onClick={async () => {
              setRefresh('busy')
              const res = await fetch(`/api/opportunities/${x.opportunity.id}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'deep' }) }).catch(() => null)
              const body = (await res?.json().catch(() => null)) as { error?: string } | null
              if (!res?.ok) return setRefresh({ error: body?.error ?? 'Could not start the research.' })
              setRefresh('started')
              router.refresh()
            }}
          >
            Refresh research, about $2.10
          </Button>
        )}
        <Link href={`/o/${x.opportunity.id}?tab=prep`} className="btn btn-primary btn-sm">
          Prepare
        </Link>
      </div>
    </li>
  )
}

const OUTCOMES: { value: Round['outcome']; label: string }[] = [
  { value: 'passed', label: 'Passed' },
  { value: 'rejected', label: 'Not through' },
  { value: 'withdrawn', label: 'I withdrew' },
]

function FollowUp({ x, onDone }: { x: AgendaItem; onDone: () => void }) {
  const [error, setError] = useState(false)
  return (
    <li className="card flex flex-wrap items-center gap-4 p-4">
      <Monogram name={x.opportunity.company} size={36} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          How did the {ROUND_LABEL[x.round.kind].toLowerCase()} at {x.opportunity.company ?? 'this company'} go?
        </p>
        <p className="t-small text-ink-3" suppressHydrationWarning>
          {new Date(x.round.at!).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          {/* non-null: the agenda lists scheduled rounds only */}
          {error && <span className="text-risk"> Not saved. Try again.</span>}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            className="h-8 rounded-full bg-sunken px-3 t-small font-medium transition-colors duration-100 hover:bg-accent hover:text-accent-ink"
            onClick={async () => {
              const res = await fetch(`/api/rounds/${x.round.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ outcome: o.value }) }).catch(() => null)
              if (res?.ok) onDone()
              else setError(true)
            }}
          >
            {o.label}
          </button>
        ))}
        <Link href={`/o/${x.opportunity.id}`} className="ml-1 t-small font-medium text-accent hover:underline">
          Add notes
        </Link>
      </div>
    </li>
  )
}

/** What needs you now: rounds coming up in the next day and a half, and rounds waiting for an outcome. */
export function UpNext({ agenda }: { agenda: AgendaItem[] }) {
  const [done, setDone] = useState<Set<string>>(new Set())
  const items = agenda.filter((x) => !done.has(x.round.id))
  if (!items.length) return null
  return (
    <section aria-labelledby="up-next" className="mt-8">
      <h2 id="up-next" className="flex items-center gap-2 t-small font-semibold">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
        Up next
        <span className="font-normal tabular-nums text-ink-3">{items.length}</span>
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((x) =>
          x.type === 'upcoming' ? <Upcoming key={x.round.id} x={x} /> : <FollowUp key={x.round.id} x={x} onDone={() => setDone((d) => new Set(d).add(x.round.id))} />,
        )}
      </ul>
    </section>
  )
}
