'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { Tab } from '../_lib/tabs'

const LABEL: Record<Tab, string> = {
  brief: 'Brief',
  company: 'What they do',
  people: 'Founders & people',
  money: 'Money',
  ai: 'AI',
  outlook: 'Outlook',
  press: 'In the press',
  prep: 'Prep',
  sources: 'Sources',
}

/** Tabs with an underline that slides to the selection. Arrow keys move between them. */
export function TabBar({ tabs, value, onChange, badge }: { tabs: readonly Tab[]; value: Tab; onChange: (t: Tab) => void; badge: Partial<Record<Tab, string>> }) {
  const refs = useRef(new Map<Tab, HTMLButtonElement>())
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const el = refs.current.get(value)
    if (el) {
      setBar({ left: el.offsetLeft, width: el.offsetWidth })
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [value, tabs])
  return (
    <div role="tablist" aria-label="Report sections" className="relative -mx-1 flex overflow-x-auto px-1 [scrollbar-width:none]">
      {tabs.map((t) => (
        <button
          key={t}
          ref={(el) => {
            if (el) refs.current.set(t, el)
          }}
          role="tab"
          id={`tab-${t}`}
          aria-selected={t === value}
          aria-controls="tab-panel"
          tabIndex={t === value ? 0 : -1}
          onClick={() => onChange(t)}
          onKeyDown={(e) => {
            const i = tabs.indexOf(value)
            const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : null
            if (next) {
              onChange(next)
              refs.current.get(next)?.focus()
            }
          }}
          className={`relative flex h-11 shrink-0 items-center gap-1.5 px-3 t-small font-semibold whitespace-nowrap transition-colors duration-150 ${t === value ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}
        >
          {LABEL[t]}
          {badge[t] && <span className="rounded-full bg-sunken px-1.5 text-[11px] tabular-nums text-ink-3">{badge[t]}</span>}
        </button>
      ))}
      {bar && <span aria-hidden className="absolute bottom-0 h-[2px] rounded-full bg-ink transition-[left,width] duration-200 ease-[var(--ease-out)]" style={{ left: bar.left + 10, width: bar.width - 20 }} />}
    </div>
  )
}
