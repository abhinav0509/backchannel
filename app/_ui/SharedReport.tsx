'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Shared } from '../../src/store/repo'
import type { QuestionTopic } from '../../src/types/research'
import { age } from '../_lib/format'
import { sourceIndex } from '../_lib/sources'
import { TABS, type Tab } from '../_lib/tabs'
import { SourcesContext } from './Evidence'
import { Monogram } from './Monogram'
import { TabBar } from './TabBar'
import { Brief } from './report/Brief'
import { AiTab, CompanyTab, MoneyTab, OutlookTab, PeopleTab, PressTab } from './report/tabs'
import { RunView } from './RunView'

const TOPICS: Record<QuestionTopic, string> = {
  role: 'The role',
  team: 'The team',
  culture: 'How they work',
  company: 'The company',
  money: 'Money and stability',
  future: 'Where it is heading',
  ai: 'AI',
  comp: 'Pay and terms',
}

/** A shared report, read-only: the research and how it was produced, never the owner's notes, fit or email. */
export function SharedReport({ s }: { s: Shared }) {
  const r = s.report
  const index = useMemo(() => sourceIndex(r), [r])
  const [tab, setTab] = useState<Tab>('brief')
  const inspectHref = s.report_run_id ? `/r/${s.share_id}/run` : null
  const deep = { running: false, shared: true }

  return (
    <SourcesContext.Provider value={index}>
      <article className="pt-6 lg:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-accent-soft px-4 py-3">
          <p className="t-small text-ink-2">
            <span className="font-semibold text-ink">A shared Backchannel report.</span> Read-only. Every fact links to the source it came from, and what could not be found is listed.
          </p>
          {inspectHref && (
            <Link href={inspectHref} className="btn btn-primary btn-sm">
              See how it was researched
            </Link>
          )}
        </div>

        <header className="mt-8 flex flex-wrap items-start gap-x-5 gap-y-4">
          <Monogram name={r.identity.display_name} size={56} />
          <div className="min-w-0 flex-1 basis-64">
            <h1 className="t-display">{r.identity.display_name}</h1>
            <p className="mt-1 text-ink-2">{r.role.title || 'No specific role'}</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 t-micro text-ink-3">
              <a href={`https://${r.identity.domain}`} target="_blank" rel="noreferrer" className="hover:text-accent">
                {r.identity.domain}
              </a>
              <span suppressHydrationWarning>Researched {age(r.generated_at).toLowerCase()}</span>
            </p>
          </div>
        </header>

        <div className="sticky top-0 z-20 mt-8 border-b border-line-soft bg-canvas/85 backdrop-blur-xl">
          <TabBar tabs={TABS} value={tab} onChange={setTab} badge={{ prep: r.questions.length ? String(r.questions.length) : undefined, sources: index.size ? String(index.size) : undefined }} />
        </div>

        <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab} className="fill-in pt-8">
          {tab === 'brief' && <Brief r={r} hasProfile={false} showFit={false} />}
          {tab === 'company' && <CompanyTab r={r} {...deep} />}
          {tab === 'people' && <PeopleTab r={r} {...deep} />}
          {tab === 'money' && <MoneyTab r={r} />}
          {tab === 'ai' && <AiTab r={r} {...deep} />}
          {tab === 'outlook' && <OutlookTab r={r} {...deep} />}
          {tab === 'press' && <PressTab r={r} {...deep} />}
          {tab === 'prep' && (
            <div className="max-w-[760px] space-y-8">
              <p className="t-small text-ink-3">Questions to ask in interviews, each drawn from something the research found or could not find.</p>
              {(Object.keys(TOPICS) as QuestionTopic[]).map((topic) => {
                const qs = r.questions.filter((q) => q.topic === topic)
                return (
                  qs.length > 0 && (
                    <section key={topic}>
                      <h2 className="t-small font-semibold text-ink-2">{TOPICS[topic]}</h2>
                      <ul className="mt-2 space-y-2">
                        {qs.map((q) => (
                          <li key={q.question} className="card p-4">
                            <p className="font-medium leading-snug">{q.question}</p>
                            {q.why && <p className="mt-1 t-small text-ink-3">{q.why}</p>}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                )
              })}
            </div>
          )}
          {tab === 'sources' && <RunView report={r} runs={s.runs} inspect={(id) => (id === s.report_run_id ? inspectHref : null)} />}
        </div>

        <footer className="mt-20 border-t border-line-soft pt-6 t-micro text-ink-3">
          Backchannel researches the companies that approach you: who owns them, who runs them, their money, layoffs, AI and press, each fact with its source. How the role fits its owner, and the people tied to the role, are left out of shared reports.
        </footer>
      </article>
    </SourcesContext.Provider>
  )
}
