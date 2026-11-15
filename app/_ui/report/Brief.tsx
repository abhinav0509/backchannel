'use client'

import { useState } from 'react'
import type { CompanyResearch, Flag, Score } from '../../../src/types/research'
import { DIMENSION_ORDER, dimensionLabel, flagLabel, splitLead } from '../../_lib/format'
import { Cites } from '../Evidence'
import { Signal } from '../Signal'
import { Gaps } from './kit'

export function FlagList({ title, flags, tone, empty }: { title: string; flags: Flag[]; tone: 'risk' | 'green'; empty: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-semibold">
        <span className="h-2 w-2 rounded-full" style={{ background: `var(--${tone})` }} aria-hidden />
        {title}
        <span className="font-normal tabular-nums text-ink-3">{flags.length}</span>
      </h2>
      {flags.length === 0 ? (
        <p className="mt-3 t-small text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {flags.map((f) => (
            <li key={f.title} className="card grid grid-cols-[3px_1fr] gap-4 p-4">
              <span
                className="rounded-full"
                style={{ background: `var(--${tone})`, opacity: 0.3 + f.severity * 0.14 }}
                title={`Severity ${f.severity} of 5`}
                aria-label={`Severity ${f.severity} of 5`}
              />
              <div className="min-w-0">
                <p className="t-micro text-ink-3">
                  {flagLabel(f.kind)}
                  {f.basis === 'profile' && ', judged against your profile'}
                </p>
                <p className="mt-0.5 font-semibold leading-snug tracking-[-0.015em]">{f.title}</p>
                <p className="mt-1.5 t-small text-ink-2">
                  {f.detail}
                  <Cites urls={f.evidence.map((e) => e.url)} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Why({ s }: { s: Score }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="border-b border-line-soft last:border-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 py-3 text-left">
        <span className="t-small font-medium">{dimensionLabel(s.dimension)}</span>
        <span className="flex items-center gap-3">
          <span className={`t-small tabular-nums ${s.unknown ? 'text-ink-3' : 'font-semibold'}`}>{s.unknown ? 'Unknown' : Math.round(s.value)}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={`text-ink-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            <path d="m2.5 4 2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <div className="reveal" data-open={open}>
        <div>
          <p className="pb-3.5 t-small text-ink-2">
            {s.rationale}
            <Cites urls={s.evidence_urls} />
          </p>
        </div>
      </div>
    </li>
  )
}

function FitList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null
  return (
    <div>
      <p className="flex items-center gap-2 t-small font-semibold">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} aria-hidden />
        {title}
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((x) => (
          <li key={x} className="t-small text-ink-2">
            {x}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** How this role fits the person reading it, from their profile. Or what it takes to see that. */
/** Re-judges this report against your profile, on the same research. Shows its own progress and errors. */
function RefreshFit({ onRefit, label, quiet }: { onRefit: () => Promise<string | null>; label: string; quiet?: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | { error: string }>('idle')
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        className={quiet ? 't-micro font-semibold text-accent hover:underline disabled:opacity-50' : 'btn btn-primary'}
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy')
          const error = await onRefit()
          setState(error ? { error } : 'idle')
        }}
      >
        {state === 'busy' ? 'Matching against your profile, one to two minutes…' : label}
      </button>
      {typeof state === 'object' && <span className="max-w-[40ch] text-right t-micro text-risk">{state.error}</span>}
    </span>
  )
}

function HowYouFit({ r, hasProfile, onRefit }: { r: CompanyResearch; hasProfile: boolean; onRefit?: () => Promise<string | null> }) {
  if (!r.fit)
    return (
      <section aria-label="How you fit" className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="max-w-[48ch]">
          <p className="font-semibold">See how this role fits you</p>
          <p className="mt-1 t-small text-ink-2">
            {hasProfile
              ? 'Your profile came after this research. Match it now, on the same research: your strengths, gaps and talking points, and fresh scores. About $0.40.'
              : 'Add your CV and Backchannel matches this role against your experience: your strengths, your gaps, and which of your projects to bring up.'}
          </p>
        </div>
        {hasProfile ? (
          onRefit && <RefreshFit onRefit={onRefit} label="Match my profile" />
        ) : (
          <a href="/welcome" className="btn btn-primary">
            Add your CV
          </a>
        )}
      </section>
    )
  return (
    <section aria-labelledby="fit" className="card p-5 sm:p-6">
      <h2 id="fit" className="t-small font-semibold text-accent">
        How you fit
      </h2>
      <p className="mt-2 max-w-[62ch] text-ink">{r.fit.summary}</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <FitList title="Your strengths here" items={r.fit.strengths} tone="var(--green)" />
        <FitList title="Gaps to address" items={r.fit.gaps} tone="var(--amber)" />
        <FitList title="Bring up" items={r.fit.talking_points} tone="var(--accent)" />
      </div>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <p className="t-micro text-ink-3">A judgement from your profile and this research.</p>
        {onRefit && <RefreshFit onRefit={onRefit} label="Changed your profile? Refresh the match, about $0.40" quiet />}
      </div>
    </section>
  )
}

/** The decision in one screen: the verdict, how it fits you, the six scores, and what argues each way. */
export function Brief({ r, hasProfile, onRefit }: { r: CompanyResearch; hasProfile: boolean; onRefit?: () => Promise<string | null> }) {
  const risks = r.flags.filter((f) => f.polarity === 'risk').sort((a, b) => b.severity - a.severity)
  const greens = r.flags.filter((f) => f.polarity === 'green').sort((a, b) => b.severity - a.severity)
  const scores = DIMENSION_ORDER.flatMap((d) => r.scores.find((s) => s.dimension === d) ?? [])
  const [lead, rest] = splitLead(r.verdict)

  return (
    <div className="space-y-12">
      {r.partial && (
        <p className="rounded-[12px] bg-amber-soft px-4 py-3 t-small text-ink-2">
          Some research did not finish, so parts of this report are missing. Sources shows which.
        </p>
      )}

      <section aria-label="Verdict">
        <p className="t-lede max-w-[36ch] text-ink">{lead}</p>
        {rest && <p className="mt-4 max-w-[68ch] text-ink-2">{rest}</p>}
      </section>

      <HowYouFit r={r} hasProfile={hasProfile} onRefit={onRefit} />

      {scores.length > 0 && (
        <section aria-labelledby="signal" className="card p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <h2 id="signal" className="font-semibold">
              Signal
            </h2>
            <span className="t-micro text-ink-3">Out of 100, never blended into one number</span>
          </div>
          <div className="mt-5">
            <Signal scores={scores} size="lg" animate />
          </div>
          <ul className="mt-6 border-t border-line-soft">
            {scores.map((s) => (
              <Why key={s.dimension} s={s} />
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-8 md:grid-cols-2 md:gap-6" aria-label="Flags">
        <FlagList title="Risks" flags={risks} tone="risk" empty="No risks found in the sources." />
        <FlagList title="In its favour" flags={greens} tone="green" empty="Nothing found in its favour." />
      </section>

      <Gaps gaps={r.gaps} />
    </div>
  )
}
