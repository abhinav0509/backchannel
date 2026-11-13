'use client'

import { useState } from 'react'
import type { CompanyResearch, Flag, Score } from '../../src/types/research'
import { DIMENSION_ORDER, dimensionLabel, flagLabel, splitLead } from '../_lib/format'
import { Cites } from './Evidence'

export function Decision({ r }: { r: CompanyResearch }) {
  const risks = r.flags.filter((f) => f.polarity === 'risk').sort((a, b) => b.severity - a.severity)
  const greens = r.flags.filter((f) => f.polarity === 'green').sort((a, b) => b.severity - a.severity)
  const scores = DIMENSION_ORDER.flatMap((d) => r.scores.find((s) => s.dimension === d) ?? [])
  const [lead, rest] = splitLead(r.verdict)

  return (
    <div className="space-y-16">
      {r.partial && (
        <p className="rounded-xl bg-sunken px-4 py-3 t-small text-ink-2">
          Some research did not finish, so this report is incomplete. The run tab shows which parts.
        </p>
      )}

      <section aria-labelledby="verdict">
        <h2 id="verdict" className="sr-only">
          Verdict
        </h2>
        <p className="t-lede max-w-[34ch] font-semibold tracking-[-0.026em] text-ink sm:max-w-[40ch]">{lead}</p>
        {rest && <p className="mt-4 max-w-[64ch] text-ink-2">{rest}</p>}
      </section>

      {scores.length > 0 && (
        <section aria-labelledby="scores">
          <h2 id="scores" className="t-title">
            Scores
          </h2>
          <p className="mt-1 t-small text-ink-3">Out of 100. Select a score to see why.</p>
          <ul className="mt-5 border-t border-line-soft">
            {scores.map((s) => (
              <ScoreRow key={s.dimension} s={s} />
            ))}
          </ul>
        </section>
      )}

      {(risks.length > 0 || greens.length > 0) && (
        <section className="grid gap-12 md:grid-cols-2 md:gap-10" aria-label="Flags">
          <FlagList title="Risks" flags={risks} tone="risk" empty="No risks found in the sources." />
          <FlagList title="In its favour" flags={greens} tone="green" empty="Nothing found in its favour." />
        </section>
      )}

      {r.questions_to_ask.length > 0 && (
        <section aria-labelledby="questions">
          <h2 id="questions" className="t-title">
            Questions to ask
          </h2>
          <p className="mt-1 t-small text-ink-3">Drawn from what was found and what could not be.</p>
          <ul className="mt-5 max-w-[68ch] space-y-3">
            {r.questions_to_ask.map((q) => (
              <li key={q} className="grid grid-cols-[14px_1fr] gap-2">
                <span className="mt-[11px] h-1 w-1 rounded-full bg-ink-3" aria-hidden />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Gaps gaps={r.gaps} />
    </div>
  )
}

function ScoreRow({ s }: { s: Score }) {
  const [open, setOpen] = useState(false)
  const tone = s.unknown ? 'var(--line)' : s.value < 40 ? 'var(--risk)' : s.value >= 70 ? 'var(--green)' : 'var(--ink-2)'
  return (
    <li className="border-b border-line-soft">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-4 py-3.5 text-left sm:grid-cols-[11rem_1fr_3rem]"
      >
        <span className="font-medium">{dimensionLabel(s.dimension)}</span>
        <span className="relative h-1.5 overflow-hidden rounded-full bg-line-soft" aria-hidden>
          {s.unknown ? (
            <span className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,var(--line)_0_3px,transparent_3px_7px)]" />
          ) : (
            <span className="meter absolute inset-y-0 left-0 rounded-full" style={{ width: `${s.value}%`, background: tone }} />
          )}
        </span>
        <span className={`text-right tabular-nums ${s.unknown ? 't-small text-ink-3' : 'font-semibold'}`}>{s.unknown ? 'Unknown' : Math.round(s.value)}</span>
      </button>
      <div className="reveal" data-open={open}>
        <div>
          <p className="max-w-[64ch] pb-4 t-small text-ink-2 sm:pl-[calc(11rem+1rem)]">
            {s.rationale}
            <Cites urls={s.evidence_urls} />
          </p>
        </div>
      </div>
    </li>
  )
}

function FlagList({ title, flags, tone, empty }: { title: string; flags: Flag[]; tone: 'risk' | 'green'; empty: string }) {
  return (
    <div>
      <h2 className="t-title">{title}</h2>
      {flags.length === 0 ? (
        <p className="mt-4 t-small text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-5 space-y-6">
          {flags.map((f) => (
            <li key={f.title} className="grid grid-cols-[3px_1fr] gap-4">
              <span
                className="rounded-full"
                style={{ background: `var(--${tone})`, opacity: 0.35 + f.severity * 0.13 }}
                title={`Severity ${f.severity} of 5`}
                aria-label={`Severity ${f.severity} of 5`}
              />
              <div>
                <p className="t-micro text-ink-3">
                  {flagLabel(f.kind)}
                  {f.basis === 'profile' && ', judged against your profile'}
                </p>
                <p className="mt-0.5 font-semibold leading-snug tracking-[-0.022em]">{f.title}</p>
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

export function Gaps({ gaps }: { gaps: string[] }) {
  const [all, setAll] = useState(false)
  if (!gaps.length) return null
  const shown = all ? gaps : gaps.slice(0, 6)
  return (
    <section aria-labelledby="gaps" className="rounded-[22px] bg-sunken p-6">
      <h2 id="gaps" className="t-title">
        What we couldn’t establish
      </h2>
      <p className="mt-1 t-small text-ink-3">A gap is not a clean bill of health. These are worth asking about.</p>
      <ul className="mt-4 max-w-[70ch] space-y-2">
        {shown.map((g) => (
          <li key={g} className="t-small text-ink-2">
            {g}
          </li>
        ))}
      </ul>
      {gaps.length > 6 && (
        <button className="mt-4 t-small font-medium text-accent hover:underline" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${gaps.length}`}
        </button>
      )}
    </section>
  )
}
