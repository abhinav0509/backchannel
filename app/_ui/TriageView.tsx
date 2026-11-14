'use client'

import type { TriageResult } from '../../src/types/research'
import { FlagList } from './report/Brief'
import { Gaps } from './report/kit'

/** The quick check: is this worth a full look? Leads with the recommendation and what full research would add. */
export function TriageView({ t, running, onDeep }: { t: TriageResult; running: boolean; onDeep: () => void }) {
  const risks = t.flags.filter((f) => f.polarity === 'risk').sort((a, b) => b.severity - a.severity)
  const greens = t.flags.filter((f) => f.polarity === 'green').sort((a, b) => b.severity - a.severity)
  return (
    <div className="space-y-12">
      <section aria-label="Recommendation">
        <p className={`t-small font-semibold ${t.deep_dive.recommended ? 'text-accent' : 'text-ink-3'}`}>
          {t.deep_dive.recommended ? 'Worth a closer look' : 'Probably not worth pursuing'}
        </p>
        <p className="t-lede mt-2 max-w-[40ch]">{t.deep_dive.reason}</p>
      </section>

      {!running && (
        <section aria-label="Full research" className="card flex flex-wrap items-center justify-between gap-5 p-5">
          <div className="max-w-[46ch]">
            <p className="font-semibold">See the whole company</p>
            <p className="mt-1 t-small text-ink-2">Founders and leaders, what they sell, money, layoffs, AI, where it is heading, six scores and questions to ask. 4 to 6 minutes, about $1.70.</p>
          </div>
          <button className={`btn ${t.deep_dive.recommended ? 'btn-primary' : 'btn-quiet'}`} onClick={onDeep}>
            Run full research
          </button>
        </section>
      )}

      <section className="grid gap-8 md:grid-cols-2 md:gap-6" aria-label="Flags">
        <FlagList title="Risks" flags={risks} tone="risk" empty="No risks turned up in a few searches." />
        <FlagList title="In its favour" flags={greens} tone="green" empty="Nothing in its favour turned up yet." />
      </section>

      <Gaps gaps={t.gaps} />
    </div>
  )
}
