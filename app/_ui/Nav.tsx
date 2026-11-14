'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { Pipeline } from '../../src/types/pipeline'
import { GROUPS, STAGE } from '../_lib/pipeline'
import { StageDot } from './StagePicker'

/** The pipeline as navigation: every stage with its count, so the shape of your search is always in view. */
export function Nav({ counts }: { counts: Partial<Record<Pipeline, number>> }) {
  const path = usePathname()
  const stage = useSearchParams().get('stage')
  const current = path === '/' ? (stage ?? 'all') : null
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
  const item = (key: string, label: string, n: number | undefined, dot?: Pipeline) => (
    <Link
      key={key}
      href={key === 'all' ? '/' : `/?stage=${key}`}
      aria-current={current === key ? 'page' : undefined}
      className={`flex h-8 items-center gap-2.5 rounded-[8px] px-2.5 t-small transition-colors duration-100 ${
        current === key ? 'bg-surface font-semibold text-ink shadow-[var(--shadow-1)]' : 'text-ink-2 hover:bg-sunken hover:text-ink'
      }`}
    >
      {dot ? <StageDot stage={dot} /> : <span className="w-2" aria-hidden />}
      <span className="flex-1 truncate">{label}</span>
      {!!n && <span className="t-micro tabular-nums text-ink-3">{n}</span>}
    </Link>
  )
  return (
    <nav aria-label="Pipeline" className="space-y-4">
      <div>{item('all', 'All opportunities', total)}</div>
      {GROUPS.map((g) => (
        <div key={g.key}>
          <p className="px-2.5 pb-1 t-micro font-medium text-ink-3">{g.label}</p>
          {g.stages.map((s) => item(s, STAGE[s].label, counts[s], s))}
        </div>
      ))}
    </nav>
  )
}
