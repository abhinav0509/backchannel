'use client'

import { useState } from 'react'
import type { ChangeItem, Changes as ChangesT } from '../../../src/types/research'
import { dimensionLabel } from '../../_lib/format'
import { Cites } from '../Evidence'

const SECTION: Record<ChangeItem['section'], string> = {
  money: 'Money',
  layoffs: 'Layoffs',
  leadership: 'Leadership change',
  leaders: 'Leadership',
  news: 'News',
  ai: 'AI',
  press: 'Press',
  contacts: 'People to know',
  scores: 'Score',
  flags: 'Flag',
}

const GROUPS: { kind: ChangeItem['kind']; title: (since: string) => string; hint?: string }[] = [
  { kind: 'new', title: (since) => `New since ${since}` },
  { kind: 'moved', title: () => 'Scores that moved' },
  { kind: 'found', title: () => 'Found this time', hint: 'Older than the last research, which did not turn them up. Not necessarily new.' },
  { kind: 'gone', title: () => 'No longer flagged' },
]

function Item({ i }: { i: ChangeItem }) {
  if (i.score)
    return (
      <li className="flex items-baseline justify-between gap-4 t-small">
        <span className="font-medium">{dimensionLabel(i.score.dimension)}</span>
        <span className="tabular-nums text-ink-2">
          {i.score.from ?? 'unknown'} to{' '}
          <span className={`font-semibold ${i.score.from !== null && i.score.to !== null ? (i.score.to < i.score.from ? 'text-risk' : 'text-green') : 'text-ink'}`}>{i.score.to ?? 'unknown'}</span>
        </span>
      </li>
    )
  return (
    <li className="grid grid-cols-[7.5rem_1fr] gap-3 t-small">
      <span className="text-ink-3">
        {SECTION[i.section]}
        {i.date && <span className="block t-micro tabular-nums">{i.date}</span>}
      </span>
      <span className={i.kind === 'gone' ? 'text-ink-3 line-through' : 'text-ink'}>
        {i.title}
        <Cites urls={i.evidence_urls} />
      </span>
    </li>
  )
}

/** What this research adds to the last one: the reason to re-run before each round. */
export function Changes({ c }: { c: ChangesT }) {
  const [all, setAll] = useState(false)
  const since = new Date(c.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (!c.items.length)
    return <p className="rounded-[12px] bg-green-soft px-4 py-3 t-small text-green">Nothing material has changed since the research on {since}.</p>
  const shown = all ? c.items : c.items.slice(0, 8)
  return (
    <section aria-labelledby="changes" className="card p-5 sm:p-6">
      <h2 id="changes" className="t-small font-semibold text-accent">
        What changed since {since}
      </h2>
      <div className="mt-4 space-y-5">
        {GROUPS.map((g) => {
          const items = shown.filter((i) => i.kind === g.kind)
          if (!items.length) return null
          return (
            <div key={g.kind}>
              <p className="font-semibold">{g.title(since)}</p>
              {g.hint && <p className="t-micro text-ink-3">{g.hint}</p>}
              <ul className="mt-2 space-y-2">
                {items.map((i, n) => (
                  <Item key={`${i.title}-${n}`} i={i} />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      {c.items.length > 8 && (
        <button className="mt-4 t-small font-medium text-accent hover:underline" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${c.items.length}`}
        </button>
      )}
    </section>
  )
}
