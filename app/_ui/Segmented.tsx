'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/** A segmented control whose selection pill slides between options, like the macOS one. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const refs = useRef(new Map<T, HTMLButtonElement>())
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const el = refs.current.get(value)
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value])

  return (
    <div role="tablist" className="relative inline-flex max-w-full overflow-x-auto rounded-full bg-sunken p-1">
      {pill && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] transition-[left,width] duration-200 ease-[var(--ease-out)]"
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          ref={(el) => {
            if (el) refs.current.set(o.value, el)
          }}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const i = options.findIndex((x) => x.value === value)
            const next = e.key === 'ArrowRight' ? options[(i + 1) % options.length] : e.key === 'ArrowLeft' ? options[(i - 1 + options.length) % options.length] : null
            if (next) {
              onChange(next.value)
              refs.current.get(next.value)?.focus()
            }
          }}
          tabIndex={o.value === value ? 0 : -1}
          className={`relative z-[1] h-8 shrink-0 rounded-full px-4 t-small font-medium whitespace-nowrap transition-colors duration-150 ${o.value === value ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
