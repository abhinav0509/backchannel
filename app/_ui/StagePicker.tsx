'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Pipeline, PipelineReason } from '../../src/types/pipeline'
import { GROUPS, REASON, reasonsFor, STAGE, toneVar } from '../_lib/pipeline'
import { Popover } from './Popover'

export function StageDot({ stage, size = 8 }: { stage: Pipeline; size?: number }) {
  const t = STAGE[stage].tone
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: t === 'muted' ? 'transparent' : toneVar[t], boxShadow: t === 'muted' ? `inset 0 0 0 1.5px ${toneVar.muted}` : undefined }}
    />
  )
}

/**
 * Where this opportunity stands with you. Passing or closing asks why in one tap (skippable),
 * which is what later shows the pattern in what you turn down.
 */
export function StagePicker({
  id,
  stage,
  reason,
  onChange,
  size = 'md',
}: {
  id: string
  stage: Pipeline
  reason: PipelineReason | null
  onChange?: (stage: Pipeline, reason: PipelineReason | null) => void
  size?: 'sm' | 'md'
}) {
  const router = useRouter()
  const [current, setCurrent] = useState({ stage, reason })
  const [asking, setAsking] = useState<Pipeline | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => setCurrent({ stage, reason }), [stage, reason]) // a refresh from the server wins

  async function save(next: Pipeline, why: PipelineReason | null, close: () => void) {
    const before = current
    setCurrent({ stage: next, reason: why })
    setAsking(null)
    close()
    onChange?.(next, why)
    const res = await fetch(`/api/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pipeline: next, pipeline_reason: why }),
    }).catch(() => null)
    if (!res?.ok) {
      setCurrent(before)
      onChange?.(before.stage, before.reason)
      setError(true)
      return
    }
    setError(false)
    router.refresh()
  }

  const s = STAGE[current.stage]
  return (
    <Popover
      label={`Stage: ${s.label}. Change stage`}
      width={300}
      trigger={(open) => (
        <span
          className={`inline-flex items-center gap-2 rounded-full bg-surface font-semibold shadow-[var(--shadow-1)] transition-[background-color,box-shadow] duration-150 hover:bg-raised ${open ? 'ring-2 ring-accent/30' : ''} ${
            size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-9 px-3.5 text-[14px]'
          } ${error ? 'ring-2 ring-risk/40' : ''}`}
          title={error ? 'Could not save. Try again.' : current.reason ? REASON[current.reason] : s.hint}
        >
          <StageDot stage={current.stage} />
          <span className="whitespace-nowrap">{s.label}</span>
          {current.reason && size === 'md' && <span className="font-normal whitespace-nowrap text-ink-3">{REASON[current.reason]}</span>}
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="text-ink-3">
            <path d="m2.5 4 2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    >
      {(close) =>
        asking ? (
          <div className="fill-in p-1.5">
            <p className="px-1 pt-1 t-small font-semibold">{asking === 'passed' ? 'Why are you passing?' : 'How did it end?'}</p>
            <p className="px-1 t-micro text-ink-3">One tap. It shows you patterns in what you turn down.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {reasonsFor(asking).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => void save(asking, r, close)}
                  className="h-8 rounded-full bg-sunken px-3 t-small font-medium transition-colors duration-100 hover:bg-accent hover:text-accent-ink focus-visible:bg-accent focus-visible:text-accent-ink"
                >
                  {REASON[r]}
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-line-soft pt-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(null)}>
                Back
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void save(asking, null, close)}>
                Skip
              </button>
            </div>
          </div>
        ) : (
          <div role="listbox" aria-label="Stages">
            {GROUPS.map((g, gi) => (
              <div key={g.key} className={gi ? 'mt-1 border-t border-line-soft pt-1' : ''}>
                <p className="px-2.5 pt-1.5 pb-1 t-micro font-medium text-ink-3">{g.label}</p>
                {g.stages.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="option"
                    aria-selected={p === current.stage}
                    onClick={() => (reasonsFor(p).length ? setAsking(p) : void save(p, null, close))}
                    className={`grid w-full grid-cols-[14px_1fr_auto] items-start gap-2 rounded-[9px] px-2.5 py-2 text-left transition-colors duration-100 hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none ${
                      p === current.stage ? 'bg-accent-soft/60' : ''
                    }`}
                  >
                    <span className="pt-[6px]">
                      <StageDot stage={p} />
                    </span>
                    <span>
                      <span className="block t-small font-semibold">{STAGE[p].label}</span>
                      <span className="block t-micro text-ink-3">{STAGE[p].hint}</span>
                    </span>
                    {p === current.stage && (
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="mt-1 text-accent">
                        <path d="m3 7.2 2.6 2.6L11 4.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )
      }
    </Popover>
  )
}
