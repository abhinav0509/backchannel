'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/**
 * A button that opens a panel anchored under it. Closes on Escape (returning focus), on a click
 * outside, and when an action inside calls close().
 */
export function Popover({
  label,
  trigger,
  children,
  align = 'start',
  width = 280,
  className = '',
}: {
  label: string
  trigger: (open: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  width?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btn.current?.focus()
    }
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  // Move focus into the panel when it opens, so keyboard users land on the first choice.
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>(`#${CSS.escape(id)} button, #${CSS.escape(id)} [href], #${CSS.escape(id)} input`)?.focus()
  }, [open, id])

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="block rounded-[10px]"
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className={`pop absolute top-[calc(100%+6px)] z-40 rounded-[14px] bg-surface p-1.5 shadow-[var(--shadow-pop)] ${align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}`}
          style={{ width }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

/** A row in a popover menu. */
export function MenuItem({ onClick, children, tone, disabled }: { onClick: () => void; children: ReactNode; tone?: 'risk'; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left t-small font-medium transition-colors duration-100 hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none disabled:opacity-40 ${tone === 'risk' ? 'text-risk' : 'text-ink'}`}
    >
      {children}
    </button>
  )
}
