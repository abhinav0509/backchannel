'use client'

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { Source } from '../_lib/sources'

export const SourcesContext = createContext<Map<string, Source>>(new Map())

const TIER: Record<string, string> = {
  primary: 'Primary source: the company or a filing',
  secondary: 'Established press or analyst',
  tertiary: 'Aggregator, blog or review site',
}

/** Inline citation markers. Each opens the quote that supports the claim, so checking is cheaper than doubting. */
export function Cites({ urls }: { urls: string[] }) {
  const index = useContext(SourcesContext)
  const unique = [...new Set(urls)].filter((u) => index.has(u))
  if (!unique.length) return null
  return (
    <span className="ml-1 inline-flex gap-0.5 align-[1px]">
      {unique.map((u) => (
        <Marker key={u} url={u} source={index.get(u)!} />
      ))}
    </span>
  )
}

function Marker({ url, source }: { url: string; source: Source }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(340, window.innerWidth - 32)
    const left = Math.max(16, Math.min(r.left - 12, window.innerWidth - width - 16))
    const below = r.bottom + 8 + 220 < window.innerHeight
    setPos({ top: below ? r.bottom + 8 : r.top - 8, left, origin: `${r.left - left + r.width / 2}px ${below ? 'top' : 'bottom'}` })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e instanceof MouseEvent && (panel.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node))) return
      setOpen(false)
      if (e instanceof KeyboardEvent) btn.current?.focus()
    }
    window.addEventListener('keydown', close)
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('keydown', close)
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  const ref = source.ref
  const host = new URL(url).hostname.replace(/^www\./, '')
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Source ${source.n}: ${ref?.title ?? host}`}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-1 text-[11px] font-semibold tabular-nums leading-none tracking-normal transition-colors duration-150 ${
          open ? 'bg-accent text-accent-ink' : 'bg-accent-soft text-accent hover:bg-accent hover:text-accent-ink'
        }`}
      >
        {source.n}
      </button>
      {open && pos && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label="Source"
          className="pop fixed z-50 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-line-soft bg-surface p-4 text-left shadow-[0_12px_40px_-12px_rgba(0,0,0,0.28),0_2px_6px_-2px_rgba(0,0,0,0.08)]"
          style={{ top: pos.top, left: pos.left, transformOrigin: pos.origin, translate: pos.origin.endsWith('bottom') ? '0 -100%' : undefined }}
        >
          {ref?.snippet && <p className="t-small text-ink">“{ref.snippet.trim()}”</p>}
          <div className={`${ref?.snippet ? 'mt-3 border-t border-line-soft pt-3' : ''} t-micro text-ink-3`}>
            <p className="font-medium text-ink-2">{ref?.publisher ?? host}</p>
            <p className="mt-0.5">
              {ref?.published_at ? `Published ${ref.published_at}` : 'Publication date not shown'}
              {ref && <span className="block">{TIER[ref.trust_tier]}</span>}
            </p>
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-block t-small font-medium text-accent hover:underline">
            Open {host}
          </a>
        </div>
      )}
    </>
  )
}

const CONFIDENCE = {
  confirmed: { label: 'Confirmed', hint: 'A primary source supports this' },
  reported: { label: 'Reported', hint: 'Credible secondary reporting' },
  unverified: { label: 'Unverified', hint: 'Rests on a single weak source' },
} as const

/** Three discrete levels with distinct glyphs: legible at a glance, and never a percentage nobody can calibrate. */
export function Confidence({ level }: { level: keyof typeof CONFIDENCE }) {
  const c = CONFIDENCE[level]
  return (
    <span className="inline-flex items-center gap-1.5 t-micro text-ink-3" title={c.hint}>
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
        {level === 'confirmed' && <circle cx="5" cy="5" r="4.5" fill="currentColor" />}
        {level === 'reported' && (
          <>
            <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M5 1a4 4 0 0 1 0 8z" fill="currentColor" />
          </>
        )}
        {level === 'unverified' && <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.6" />}
      </svg>
      {c.label}
    </span>
  )
}
