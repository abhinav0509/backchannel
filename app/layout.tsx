import type { Metadata, Viewport } from 'next'
import { Schibsted_Grotesk } from 'next/font/google'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { authMode } from '../src/server/auth'
import { pipelineCounts } from '../src/store/repo'
import { allowance } from '../src/util/cost'
import { usd } from './_lib/format'
import { currentUser } from './_lib/session'
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

/** This month's research spend: everyone's against the overall cap for the admin, your own against your allowance otherwise. */
function Spend({ spent, cap, admin }: { spent: number; cap: number; admin: boolean }) {
  const share = Math.min(1, spent / cap)
  return (
    <div className="px-2.5" title={admin ? 'Everyone’s research spend this month. New research stops at the cap.' : 'Your research spend this month. It resets on the 1st.'}>
      <p className="t-micro text-ink-3">
        <span className="font-semibold text-ink-2">{usd(spent)}</span> of {admin ? usd(cap) : `your ${usd(cap)}`} research this month
      </p>
      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
        <span className="meter block h-full rounded-full" style={{ width: `${share * 100}%`, background: share > 0.85 ? 'var(--risk)' : 'var(--ink-3)' }} />
      </span>
    </div>
  )
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser().catch(() => null)
  const owner = user?.id ?? null
  const admin = user?.role === 'admin'
  const [left, counts] = owner ? await Promise.all([allowance(owner), pipelineCounts(owner)]) : [null, {}]
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
                {left && <Spend spent={left.spentUsd} cap={left.capUsd} admin={admin} />}
                <div className="flex items-center justify-between px-1">
                  <span className="flex items-center gap-0.5">
                    <Link href="/profile" className="btn btn-ghost btn-sm">
                      Your profile
                    </Link>
                    {admin && (
                      <Link href="/people" className="btn btn-ghost btn-sm">
                        People
                      </Link>
                    )}
                  </span>
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
