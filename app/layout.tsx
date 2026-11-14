import type { Metadata, Viewport } from 'next'
import { Schibsted_Grotesk } from 'next/font/google'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { BUDGETS } from '../src/config'
import { authMode } from '../src/server/auth'
import { pipelineCounts } from '../src/store/repo'
import { monthSpend } from '../src/util/cost'
import { usd } from './_lib/format'
import { currentOwner } from './_lib/session'
import { Brand } from './_ui/Brand'
import { Nav } from './_ui/Nav'
import { NewResearch } from './_ui/NewResearch'
import { SignOut } from './_ui/SignOut'
import './globals.css'

const grotesk = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-grotesk', display: 'swap' })

export const metadata: Metadata = {
  title: 'Backchannel',
  description: 'Sourced due diligence on the companies that approach you.',
}
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f4f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0e11' },
  ],
}
export const dynamic = 'force-dynamic'

function Spend({ spent }: { spent: number }) {
  const cap = BUDGETS.monthlyUsd
  const share = Math.min(1, spent / cap)
  return (
    <div className="px-2.5" title="Research spend this month. New research stops at the cap.">
      <p className="t-micro text-ink-3">
        <span className="font-semibold text-ink-2">{usd(spent)}</span> of {usd(cap)} research this month
      </p>
      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
        <span className="meter block h-full rounded-full" style={{ width: `${share * 100}%`, background: share > 0.85 ? 'var(--risk)' : 'var(--ink-3)' }} />
      </span>
    </div>
  )
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const owner = await currentOwner().catch(() => null)
  const [spent, counts] = owner ? await Promise.all([monthSpend(), pipelineCounts(owner)]) : [0, {}]
  return (
    <html lang="en" className={grotesk.variable}>
      <body className="min-h-dvh">
        {owner ? (
          <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
            <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line-soft px-3 pt-5 pb-4 lg:flex">
              <div className="px-2.5">
                <Brand />
              </div>
              <NewResearch shortcut />
              <div className="-mx-1 flex-1 overflow-y-auto px-1">
                <Suspense>
                  <Nav counts={counts} />
                </Suspense>
              </div>
              <div className="space-y-3 border-t border-line-soft pt-4">
                <Spend spent={spent} />
                <div className="flex items-center justify-between px-1">
                  <Link href="/profile" className="btn btn-ghost btn-sm">
                    Your profile
                  </Link>
                  {authMode() === 'supabase' && <SignOut />}
                </div>
              </div>
            </aside>

            <div className="min-w-0">
              <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line-soft bg-canvas/85 px-4 backdrop-blur-xl lg:hidden">
                <Brand />
                <div className="flex items-center gap-2">
                  <Link href="/profile" className="btn btn-ghost btn-sm">
                    Profile
                  </Link>
                  <div className="w-[96px]">
                    <NewResearch label="New" />
                  </div>
                </div>
              </header>
              <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-6 lg:px-10">{children}</main>
            </div>
          </div>
        ) : (
          <main className="mx-auto max-w-[980px] px-5 pb-24">{children}</main>
        )}
      </body>
    </html>
  )
}
