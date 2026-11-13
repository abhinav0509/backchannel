'use client'

import { useContext } from 'react'
import type { Opportunity } from '../../src/store/repo'
import type { StageName } from '../../src/types/research'
import { age, stageLabel, usd } from '../_lib/format'
import { SourcesContext } from './Evidence'

const n = (x: number) => x.toLocaleString('en-US')

/** Proof of work: what ran, what it cost, and every source used. */
export function RunView({ o }: { o: Opportunity }) {
  const index = useContext(SourcesContext)
  const deep = [...o.runs].reverse().find((r) => r.mode === 'deep' && r.status === 'done') ?? o.runs.at(-1)
  const status = o.report?.run.stage_status ?? {}
  const stages = deep ? (Object.entries(deep.stages) as [StageName, (typeof deep.stages)[StageName]][]) : []

  return (
    <div className="max-w-[760px] space-y-16">
      {deep && (
        <section>
          <h2 className="t-title">This report</h2>
          <p className="mt-1 t-small text-ink-3">
            {n(deep.searches)} web searches, {n(deep.input_tokens + deep.output_tokens)} tokens, {usd(deep.cost_usd)}
            {o.report && `, ${Math.round(o.report.run.duration_ms / 1000)} seconds`}. Repeated requests are served from cache at no cost.
          </p>
          <table className="mt-5 w-full t-small">
            <thead>
              <tr className="border-b border-line-soft text-left text-ink-3">
                <th className="py-2 font-normal">Stage</th>
                <th className="py-2 text-right font-normal">Searches</th>
                <th className="hidden py-2 text-right font-normal sm:table-cell">Tokens</th>
                <th className="py-2 text-right font-normal">Cost</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {stages.map(([name, s]) => (
                <tr key={name} className="border-b border-line-soft">
                  <td className="py-2.5">
                    {stageLabel(name)}
                    {status[name] && status[name] !== 'ok' && <span className={`ml-2 ${status[name] === 'failed' ? 'text-risk' : 'text-amber'}`}>{status[name] === 'failed' ? 'Failed' : 'Incomplete'}</span>}
                  </td>
                  <td className="py-2.5 text-right">{s?.searches ?? 0}</td>
                  <td className="hidden py-2.5 text-right sm:table-cell">{n((s?.input ?? 0) + (s?.output ?? 0))}</td>
                  <td className="py-2.5 text-right">{usd(s?.usd ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2 className="t-title">Sources</h2>
        <p className="mt-1 t-small text-ink-3">Every source cited in the report, numbered as in the text.</p>
        <ol className="mt-5">
          {[...index.entries()].map(([url, s]) => (
            <li key={url} className="grid grid-cols-[2rem_1fr] border-b border-line-soft py-3">
              <span className="t-small tabular-nums text-ink-3">{s.n}</span>
              <span className="min-w-0">
                <a href={url} target="_blank" rel="noreferrer" className="block truncate font-medium hover:text-accent">
                  {s.ref?.title ?? url}
                </a>
                <span className="block truncate t-micro text-ink-3">
                  {[s.ref?.publisher ?? new URL(url).hostname, s.ref?.published_at, s.ref && { primary: 'Primary', secondary: 'Secondary', tertiary: 'Tertiary' }[s.ref.trust_tier]]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="t-title">History</h2>
        <ul className="mt-4">
          {[...o.runs].reverse().map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-4 border-b border-line-soft py-3 t-small">
              <span>
                {r.mode === 'deep' ? 'Full research' : 'Quick check'}
                <span className="text-ink-3"> {age(r.started_at).toLowerCase()}</span>
                {r.status === 'failed' && <span className="block text-risk">{r.error}</span>}
                {r.status === 'needs_choice' && <span className="block text-amber">Stopped to ask which company</span>}
              </span>
              <span className="tabular-nums text-ink-3">{usd(r.cost_usd)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
