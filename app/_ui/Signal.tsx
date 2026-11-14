import type { ScoreDimension } from '../../src/types/research'
import { DIMENSION_ORDER, dimensionLabel } from '../_lib/format'

type S = { dimension: ScoreDimension; value: number; unknown: boolean }

const tone = (s: S | undefined) => (!s || s.unknown ? 'var(--line-strong)' : s.value < 40 ? 'var(--risk)' : s.value >= 70 ? 'var(--green)' : 'var(--ink-2)')

const describe = (by: Map<ScoreDimension, S>) =>
  DIMENSION_ORDER.map((d) => {
    const s = by.get(d)
    return `${dimensionLabel(d)} ${!s || s.unknown ? 'unknown' : Math.round(s.value)}`
  }).join(', ')

/**
 * The six scores as six bars in a fixed order: the parts at a glance, never one blended number
 * (a 72 that hides a 20 on job security is worse than no number). Unknown is a hollow stub.
 */
export function Signal({ scores, size = 'sm', animate = false }: { scores: S[]; size?: 'sm' | 'lg'; animate?: boolean }) {
  const by = new Map(scores.map((s) => [s.dimension, s]))
  if (size === 'sm') {
    if (!scores.length) return <span className="block h-[20px] w-[51px]" aria-hidden />
    return (
      <span className="flex h-[20px] items-end gap-[3px]" role="img" aria-label={describe(by)} title={describe(by)}>
        {DIMENSION_ORDER.map((d) => {
          const s = by.get(d)
          if (!s || s.unknown) return <span key={d} className="h-[5px] w-[6px] rounded-[2px] border border-line-strong" />
          return <span key={d} className="w-[6px] rounded-[2px]" style={{ height: `${(Math.max(10, s.value) / 100) * 20}px`, background: tone(s) }} />
        })}
      </span>
    )
  }
  return (
    <div role="img" aria-label={describe(by)} className="grid grid-cols-6 gap-2 sm:gap-3">
      {DIMENSION_ORDER.map((d, i) => {
        const s = by.get(d)
        const known = s && !s.unknown
        return (
          <div key={d} className="flex min-w-0 flex-col">
            <span className={`t-title tabular-nums ${known ? 'text-ink' : 'text-ink-3'}`}>{known ? Math.round(s.value) : '–'}</span>
            <span className="relative mt-2 block h-24 overflow-hidden rounded-[6px] bg-sunken">
              {known ? (
                <span
                  className={`absolute inset-x-0 bottom-0 rounded-[6px] ${animate ? 'rise' : ''}`}
                  style={{ height: `${Math.max(4, s.value)}%`, background: tone(s), animationDelay: animate ? `${i * 45}ms` : undefined }}
                />
              ) : (
                <span className="absolute inset-0 rounded-[6px] bg-[repeating-linear-gradient(-45deg,var(--line)_0_2px,transparent_2px_6px)]" />
              )}
            </span>
            <span className="mt-2 truncate t-micro text-ink-2" title={dimensionLabel(d)}>
              {dimensionLabel(d)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
