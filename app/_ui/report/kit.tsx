'use client'

import { useState, type ReactNode } from 'react'
import type { EvidenceRef } from '../../../src/types/research'
import { Cites, Confidence } from '../Evidence'

export type C<T> = { value: T; confidence: 'confirmed' | 'reported' | 'unverified'; evidence: EvidenceRef[]; as_of: string | null; note?: string | null }

export const n = (x: number) => x.toLocaleString('en-US')
export const urls = (c: { evidence: EvidenceRef[] }) => c.evidence.map((e) => e.url)

/** A titled block of a tab. The title is the question the block answers. */
export function Section({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-28">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="t-title">
          {title}
        </h2>
        {aside && <span className="t-micro text-ink-3">{aside}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** One sourced fact as label and value, with its citations and how sure the sources are. */
export function Fact<T>({ label, c, show = String }: { label: string; c: C<T> | null; show?: (v: T) => ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line-soft py-3.5 last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-6">
      <dt className="t-small text-ink-3">{label}</dt>
      <dd className="min-w-0">
        {c ? (
          <>
            <span>{show(c.value)}</span>
            <Cites urls={urls(c)} />
            <span className="mt-1 flex flex-wrap items-center gap-x-3">
              <Confidence level={c.confidence} />
              {c.as_of && <span className="t-micro text-ink-3">As of {c.as_of}</span>}
            </span>
            {c.note && <span className="mt-1 block t-small text-ink-3">{c.note}</span>}
          </>
        ) : (
          <span className="text-ink-3">Not established</span>
        )}
      </dd>
    </div>
  )
}

export function Facts({ children }: { children: ReactNode }) {
  return <dl className="card px-5">{children}</dl>
}

/** Dated events down a rule, newest first where dates allow: funding, layoffs, news, AI launches. */
export function Timeline<T>({ items, date, children, empty }: { items: C<T>[]; date: (v: T) => string | null; children: (v: T) => ReactNode; empty: string }) {
  if (!items.length) return <p className="t-small text-ink-3">{empty}</p>
  const sorted = [...items].sort((a, b) => (date(b.value) ?? '').localeCompare(date(a.value) ?? ''))
  return (
    <ol className="relative ml-[5px] border-l border-line">
      {sorted.map((c, i) => (
        <li key={i} className="relative pb-6 pl-6 last:pb-0">
          <span className="absolute top-[7px] -left-[5px] h-[9px] w-[9px] rounded-full border-2 border-canvas bg-ink-3" aria-hidden />
          <p className="t-micro font-medium tabular-nums text-ink-3">{date(c.value) ?? 'Date unknown'}</p>
          <div className="mt-0.5">
            {children(c.value)}
            <Cites urls={urls(c)} />
          </div>
          <span className="mt-1 block">
            <Confidence level={c.confidence} />
          </span>
        </li>
      ))}
    </ol>
  )
}

/** A plain list of sourced statements. */
export function Claims<T>({ items, children, empty }: { items: C<T>[]; children: (v: T) => ReactNode; empty: string }) {
  if (!items.length) return <p className="t-small text-ink-3">{empty}</p>
  return (
    <ul className="space-y-3">
      {items.map((c, i) => (
        <li key={i} className="grid grid-cols-[14px_1fr] gap-2">
          <span className="mt-[10px] h-1 w-1 rounded-full bg-ink-3" aria-hidden />
          <span>
            {children(c.value)}
            <Cites urls={urls(c)} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Shown on a tab whose research has not run: says what it would add and offers to run it. */
export function NotYet({ what, onDeep, running }: { what: string; onDeep?: () => void; running: boolean }) {
  return (
    <div className="card mx-auto max-w-[560px] p-8 text-center">
      <p className="t-title">Not researched yet</p>
      <p className="mx-auto mt-2 max-w-[44ch] t-small text-ink-2">{what}</p>
      {onDeep && !running && (
        <button className="btn btn-primary mt-5" onClick={onDeep}>
          Run full research
        </button>
      )}
      {running && <p className="mt-4 t-small text-accent">Research is running. This fills in when it finishes.</p>}
    </div>
  )
}

/** What could not be established. A gap is not a clean bill of health. */
export function Gaps({ gaps, title = 'What we couldn’t establish' }: { gaps: string[]; title?: string }) {
  const [all, setAll] = useState(false)
  if (!gaps.length) return null
  const shown = all ? gaps : gaps.slice(0, 5)
  return (
    <section aria-label={title} className="rounded-[16px] bg-sunken p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="t-micro text-ink-3">A gap is not a clean bill of health. Each one is worth asking about.</p>
      <ul className="mt-3 space-y-1.5">
        {shown.map((g) => (
          <li key={g} className="t-small text-ink-2">
            {g}
          </li>
        ))}
      </ul>
      {gaps.length > 5 && (
        <button className="mt-3 t-small font-medium text-accent hover:underline" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${gaps.length}`}
        </button>
      )}
    </section>
  )
}
