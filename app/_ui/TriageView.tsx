'use client'

import type { TriageResult } from '../../src/types/research'
import { flagLabel } from '../_lib/format'
import { Gaps } from './Decision'
import { Cites } from './Evidence'

export function TriageView({ t, running, onDeep }: { t: TriageResult; running: boolean; onDeep: () => void }) {
  const flags = [...t.flags].sort((a, b) => (a.polarity === b.polarity ? b.severity - a.severity : a.polarity === 'risk' ? -1 : 1))
  return (
    <div className="space-y-12">
      <section className="rounded-[22px] border border-line-soft bg-surface p-6">
        <p className={`t-small font-semibold ${t.deep_dive.recommended ? 'text-accent' : 'text-ink-3'}`}>
          {t.deep_dive.recommended ? 'Worth a closer look' : 'Probably not worth pursuing'}
        </p>
        <p className="t-lede mt-2 max-w-[60ch]">{t.deep_dive.reason}</p>
        {!running && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className={`btn ${t.deep_dive.recommended ? 'btn-primary' : 'btn-quiet'}`} onClick={onDeep}>
              Run full research
            </button>
            <span className="t-micro text-ink-3">Ownership, money, people, scores and questions to ask. About 3 minutes, around $1.30.</span>
          </div>
        )}
      </section>

      <section>
        <h2 className="t-title">What the quick check found</h2>
        {flags.length === 0 ? (
          <p className="mt-3 t-small text-ink-3">No red or green flags turned up in a few searches.</p>
        ) : (
          <ul className="mt-5 space-y-6">
            {flags.map((f) => (
              <li key={f.title} className="grid grid-cols-[3px_1fr] gap-4">
                <span className="rounded-full" style={{ background: f.polarity === 'risk' ? 'var(--risk)' : 'var(--green)', opacity: 0.35 + f.severity * 0.13 }} aria-hidden />
                <div>
                  <p className="t-micro text-ink-3">{flagLabel(f.kind)}</p>
                  <p className="mt-0.5 font-semibold">{f.title}</p>
                  <p className="mt-1.5 max-w-[64ch] t-small text-ink-2">
                    {f.detail}
                    <Cites urls={f.evidence.map((e) => e.url)} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Gaps gaps={t.gaps} />
    </div>
  )
}
