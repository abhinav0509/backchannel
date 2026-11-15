'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { estimate } from '../_lib/progress'
import { Spinner } from './Button'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function Step({ label, state }: { label: string; state: 'done' | 'now' | 'next' }) {
  return (
    <li className="flex items-center gap-2.5 t-small">
      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center">
        {state === 'done' ? (
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="fill-in">
            <circle cx="9" cy="9" r="9" fill="var(--green)" />
            <path d="m5.5 9.2 2.3 2.3 4.7-5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : state === 'now' ? (
          <Spinner size={16} className="text-accent" />
        ) : (
          <span className="h-[14px] w-[14px] rounded-full border-2 border-line" aria-hidden />
        )}
      </span>
      <span className={state === 'next' ? 'text-ink-3' : state === 'now' ? 'font-medium text-ink' : 'text-ink-2'}>{label}</span>
    </li>
  )
}

/**
 * Work that takes seconds to minutes, shown as it happens: what it is doing now, what is done, how
 * long it has been and usually takes, and a sketch of the result. Steps are estimated from the
 * usual duration (the server reports only the end), and the copy says so when it runs long.
 */
export function TaskProgress({
  title,
  steps,
  expectedSeconds,
  done = false,
  preview,
  note,
  canLeave = false,
}: {
  title: string
  steps: string[]
  expectedSeconds: number
  done?: boolean
  preview?: ReactNode
  note?: string
  canLeave?: boolean // true only when the work carries on without this page open
}) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (done) return
    const started = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250)
    return () => clearInterval(t)
  }, [done])
  const p = estimate(elapsed, expectedSeconds, steps.length, done)
  const usual = expectedSeconds >= 90 ? `${Math.round(expectedSeconds / 60)} minutes` : `${expectedSeconds} seconds`

  return (
    <section aria-label={title} aria-busy={!done} className="card fill-in overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-semibold">{title}</h2>
          <span className="t-small tabular-nums text-ink-3">{clock(elapsed)}</span>
        </div>
        <div className="progress-track mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.fraction * 100)} aria-label={title}>
          <div className="progress-fill" data-done={done} style={{ width: `${Math.max(3, p.fraction * 100)}%` }} />
        </div>
        <ol className="mt-5 space-y-2.5" aria-live="polite">
          {steps.map((s, i) => (
            <Step key={s} label={s} state={i < p.step ? 'done' : i === p.step ? 'now' : 'next'} />
          ))}
        </ol>
        <p className="mt-5 t-micro text-ink-3">
          {p.slow
            ? `Taking longer than usual. Still working${canLeave ? '; you can leave this page and come back.' : ', please keep this page open.'}`
            : (note ?? `Usually about ${usual}.${canLeave ? ' You can leave this page; it carries on.' : ' Keep this page open until it finishes.'}`)}
        </p>
      </div>
      {preview && (
        <div className="border-t border-line-soft bg-raised p-5 sm:p-6" aria-hidden>
          {preview}
        </div>
      )}
    </section>
  )
}

/** Lines in the shape of a paragraph or list, for previews of content still on its way. */
export function SkeletonLines({ lines = 3, widths = ['92%', '84%', '60%'] }: { lines?: number; widths?: string[] }) {
  return (
    <span className="block space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton block h-3" style={{ width: widths[i % widths.length] }} />
      ))}
    </span>
  )
}
