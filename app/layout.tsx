import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { BUDGETS } from '../src/config'
import { monthSpend } from '../src/util/cost'
import { usd } from './_lib/format'
import './globals.css'

export const metadata: Metadata = {
  title: 'Backchannel',
  description: 'Sourced due diligence on the companies that approach you.',
}
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfd' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}
export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: ReactNode }) {
  const spent = monthSpend()
  const cap = BUDGETS.monthlyUsd
  const share = Math.min(1, spent / cap)
  return (
    <html lang="en">
      <body className="min-h-dvh bg-canvas text-ink">
        <header className="sticky top-0 z-20 border-b border-line-soft bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex h-12 max-w-[980px] items-center justify-between px-5">
            <Link href="/" className="rounded-md text-[17px] font-[650] tracking-[-0.03em]">
              Backchannel
            </Link>
            <div className="flex items-center gap-2.5 t-micro text-ink-3" title="Research spend this month. New runs stop at the cap.">
              <span className="tabular-nums">
                {usd(spent)} of {usd(cap)} this month
              </span>
              <span className="relative h-1 w-14 overflow-hidden rounded-full bg-line-soft" aria-hidden>
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${share * 100}%`, background: share > 0.85 ? 'var(--risk)' : 'var(--ink-3)' }}
                />
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[980px] px-5 pb-24">{children}</main>
      </body>
    </html>
  )
}
