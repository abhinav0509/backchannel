import { DIMENSION_ORDER, dimensionLabel } from '../_lib/format'
import type { Summary } from '../../src/server/api'

/**
 * Six bars, one per dimension, in a fixed order. Shows the parts at a glance instead of one
 * blended number (a 72 that hides a 20 on job security is worse than no number).
 */
export function ScoreGlyph({ scores }: { scores: Summary['scores'] }) {
  if (!scores.length) return <span className="block h-[22px] w-[52px]" aria-hidden />
  const by = new Map(scores.map((s) => [s.dimension, s]))
  const label = DIMENSION_ORDER.map((d) => {
    const s = by.get(d)
    return `${dimensionLabel(d)} ${!s || s.unknown ? 'unknown' : Math.round(s.value)}`
  }).join(', ')
  return (
    <span className="flex h-[22px] items-end gap-[3px]" role="img" aria-label={label} title={label}>
      {DIMENSION_ORDER.map((d) => {
        const s = by.get(d)
        if (!s || s.unknown) return <span key={d} className="h-[6px] w-[6px] rounded-[2px] border border-dashed border-ink-3/70" />
        const v = Math.max(8, s.value)
        return (
          <span
            key={d}
            className="w-[6px] rounded-[2px]"
            style={{ height: `${(v / 100) * 22}px`, background: s.value < 40 ? 'var(--risk)' : s.value >= 70 ? 'var(--green)' : 'var(--ink-3)' }}
          />
        )
      })}
    </span>
  )
}
