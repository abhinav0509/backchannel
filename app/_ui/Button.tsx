'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** The one loading indicator: a ring that turns, sized to sit inside text. */
export function Spinner({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`spinner shrink-0 ${className}`} width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * A button that shows it is working. Both labels sit in the same grid cell, so the button keeps
 * the width of the longer one and nothing around it moves; while pending it ignores clicks and
 * says so to screen readers.
 */
export function Button({
  pending = false,
  pendingLabel,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean; pendingLabel?: ReactNode }) {
  return (
    <button {...rest} className={`btn ${className}`} disabled={disabled || pending} aria-busy={pending}>
      <span className="grid place-items-center">
        <span className={`col-start-1 row-start-1 inline-flex items-center gap-2 transition-opacity duration-150 ${pending ? 'opacity-0' : ''}`}>{children}</span>
        <span className={`col-start-1 row-start-1 inline-flex items-center gap-2 transition-opacity duration-150 ${pending ? '' : 'opacity-0'}`} aria-hidden={!pending}>
          <Spinner />
          {pendingLabel ?? children}
        </span>
      </span>
    </button>
  )
}
