'use client'

import { useEffect, useRef, useState } from 'react'
import type { Opportunity } from '../../../src/store/repo'

type Fields = Pick<Opportunity, 'notes' | 'next_step' | 'next_step_at'>

/** Saves a patch shortly after the last keystroke, and says whether it landed. */
export function useAutosave(id: string) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Record<string, unknown>>({})
  const flush = async () => {
    const body = pending.current
    pending.current = {}
    setState('saving')
    const res = await fetch(`/api/opportunities/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    setState(res?.ok ? 'saved' : 'error')
  }
  // Leaving the page must not drop the last few keystrokes.
  useEffect(
    () => () => {
      if (!timer.current) return
      clearTimeout(timer.current)
      if (Object.keys(pending.current).length) void flush()
    },
    [], // flush reads refs only, so it never goes stale
  )
  return {
    state,
    save: (patch: Record<string, unknown>, delay = 700) => {
      pending.current = { ...pending.current, ...patch }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), delay)
    },
  }
}

export function SaveState({ state }: { state: ReturnType<typeof useAutosave>['state'] }) {
  return (
    <span className="t-micro text-ink-3" aria-live="polite">
      {state === 'saving' && 'Saving…'}
      {state === 'saved' && 'Saved'}
      {state === 'error' && <span className="text-risk">Not saved. Check your connection.</span>}
    </span>
  )
}

/** Your side of it: the next thing that has to happen, and what you know that research cannot. */
export function Tracker({ id, initial }: { id: string; initial: Fields }) {
  const [f, setF] = useState(initial)
  const { state, save } = useAutosave(id)
  const set = (patch: Partial<Fields>, delay?: number) => {
    setF((x) => ({ ...x, ...patch }))
    save(patch, delay)
  }
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Next step</h2>
        <SaveState state={state} />
      </div>
      <div className="mt-3 grid gap-2">
        <label className="block">
          <span className="sr-only">What happens next</span>
          <input value={f.next_step ?? ''} onChange={(e) => set({ next_step: e.target.value || null })} placeholder="Recruiter call, portfolio review…" maxLength={200} className="field text-[14px]" />
        </label>
        <label className="block">
          <span className="sr-only">When</span>
          <input type="date" value={f.next_step_at ?? ''} onChange={(e) => set({ next_step_at: e.target.value || null }, 0)} className="field text-[14px] tabular-nums" />
        </label>
      </div>
      <h2 className="mt-6 font-semibold">Notes</h2>
      <label className="mt-3 block">
        <span className="sr-only">Notes</span>
        <textarea
          value={f.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Who you spoke to, what they said, your read on them."
          rows={6}
          maxLength={20000}
          className="field field-sizing-content min-h-[140px] resize-none text-[14px] leading-[1.55]"
        />
      </label>
    </div>
  )
}
