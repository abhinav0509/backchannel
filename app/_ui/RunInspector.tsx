import Link from 'next/link'
import type { RunTrace } from '../../src/store/repo'
import type { CallTrace } from '../../src/types/trace'
import { stageLabel, usd } from '../_lib/format'
import { duration, modelName, timeline, type StageRow } from '../_lib/trace'

const STATUS: Record<StageRow['status'], { label: string; chip: string; bar: string }> = {
  ok: { label: 'Done', chip: 'bg-green-soft text-green', bar: 'var(--accent)' },
  partial: { label: 'Incomplete', chip: 'bg-amber-soft text-amber', bar: 'var(--amber)' },
  failed: { label: 'Failed', chip: 'bg-risk-soft text-risk', bar: 'var(--risk)' },
  running: { label: 'Running', chip: 'bg-sky-soft text-sky', bar: 'var(--sky)' },
}

const n = (x: number) => x.toLocaleString('en-US')
const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${k === 1 ? one : many}`

/** Tick marks every 10 s, 30 s, 1 min or 2 min, whichever gives four to eight across the run. */
function ticks(total: number): number[] {
  const step = [10, 30, 60, 120, 300].map((s) => s * 1000).find((s) => total / s <= 8) ?? 600_000
  return Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step)
}
const clock = (ms: number) => (ms < 60_000 ? `${ms / 1000}s` : `${Math.floor(ms / 60_000)}m${ms % 60_000 ? `${(ms % 60_000) / 1000}s` : ''}`)

function what(c: CallTrace): string {
  if (c.kind === 'search') return c.stage === 'resolve' ? 'Searched for the company' : 'Searched the web and wrote cited notes'
  if (c.stage === 'parse') return 'Read the email into fields'
  if (c.stage === 'synthesize') return 'Weighed the research into flags, scores and questions'
  return 'Turned the notes into checked, sourced fields'
}

function outcome(c: CallTrace): { text: string; tone: string } | null {
  const d = c.detail
  if (c.kind === 'search') {
    const parts = [plural(c.searches, 'search', 'searches'), d.found !== null && `${n(d.found)} pages found`, d.cited !== null && `${n(d.cited)} cited`].filter(Boolean)
    return { text: `${parts.join(', ')}.${d.capped ? ' Stopped at its search limit.' : ''}`, tone: d.capped ? 'text-amber' : 'text-ink-3' }
  }
  if (d.outcome === 'cut_off') return { text: 'The answer ran past the length limit, so it was asked again for less.', tone: 'text-amber' }
  if (d.outcome === 'invalid') return { text: 'Failed the schema or source checks, so the errors went back for a correction.', tone: 'text-amber' }
  if (d.outcome === 'valid') return { text: d.dropped.length ? `Passed the checks after removing ${plural(d.dropped.length, 'item')} with no source.` : 'Passed the schema and source checks.', tone: 'text-ink-3' }
  return null
}

function Call({ c }: { c: CallTrace }) {
  const o = outcome(c)
  const d = c.detail
  return (
    <li className="grid grid-cols-[14px_1fr] gap-3 py-3">
      <span className={`mt-[7px] h-2 w-2 rounded-full ${c.kind === 'search' ? 'bg-accent' : 'bg-ink-3'}`} aria-hidden />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <p className="t-small font-medium">
            {what(c)}
            <span className="font-normal text-ink-3">
              {' '}
              with {modelName(c.model)}
              {d.attempt > 1 && `, attempt ${d.attempt}`}
            </span>
          </p>
          <p className="t-micro tabular-nums text-ink-3">{c.cached ? 'From cache, no cost' : `${duration(c.ms)}, ${usd(c.usd)}`}</p>
        </div>
        {o && <p className={`mt-0.5 t-micro ${o.tone}`}>{o.text}</p>}
        {d.suspect.length > 0 && (
          <p className="mt-1.5 rounded-[8px] bg-amber-soft px-2.5 py-1.5 t-micro text-ink-2">
            {plural(d.suspect.length, 'quote')} from the web read like instructions to an AI (“{d.suspect[0]}”). Treated as text to analyse, not followed.
          </p>
        )}
        {d.queries.length > 0 && (
          <details className="group mt-1.5">
            <summary className="cursor-pointer list-none t-micro font-medium text-accent">
              <span className="mr-1 inline-block transition-transform duration-150 group-open:rotate-90">›</span>
              {plural(d.queries.length, 'query', 'queries')}
            </summary>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {d.queries.map((q, i) => (
                <li key={i} className="rounded-full bg-sunken px-2.5 py-0.5 t-micro text-ink-2">
                  {q}
                </li>
              ))}
            </ul>
          </details>
        )}
        {(d.issues || d.dropped.length > 0) && (
          <details className="group mt-1.5">
            <summary className="cursor-pointer list-none t-micro font-medium text-accent">
              <span className="mr-1 inline-block transition-transform duration-150 group-open:rotate-90">›</span>
              {d.issues ? 'What failed' : 'What was removed'}
            </summary>
            <pre className="mt-1.5 max-h-48 overflow-auto rounded-[8px] bg-sunken p-2.5 font-sans t-micro whitespace-pre-wrap text-ink-2">{d.issues ?? d.dropped.join('\n')}</pre>
          </details>
        )}
      </div>
    </li>
  )
}

function Fact({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <li className="flex items-baseline gap-3 py-2.5">
      <span className={`w-8 shrink-0 text-right text-[17px] font-semibold tabular-nums ${value > 0 ? (tone ?? 'text-ink') : 'text-ink-3'}`}>{n(value)}</span>
      <span className="t-small text-ink-2">{label}</span>
    </li>
  )
}

/** How one research run worked: when each stage ran, every model call and search, and what the guardrails caught. */
export function RunInspector({ trace, back }: { trace: RunTrace; back: { href: string; label: string } }) {
  const { total, rows, totals } = timeline(trace)
  const run = trace.run
  const span = Math.max(total, 1)
  const started = new Date(run.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })

  return (
    <article className="pt-6 pb-10 lg:pt-8">
      <Link href={back.href} className="inline-flex items-center gap-1.5 t-small font-medium text-ink-3 hover:text-ink">
        <svg width="7" height="12" viewBox="0 0 7 12" aria-hidden>
          <path d="M5.5 1.5 1.5 6l4 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {back.label}
      </Link>

      <header className="mt-5 max-w-[64ch]">
        <h1 className="t-display">How this research ran</h1>
        <p className="mt-2 text-ink-2">
          {run.mode === 'deep'
            ? 'A fixed pipeline: read the email, confirm the company, then six research agents search in parallel, each citing what it finds. Every claim is checked against what the search actually returned before a last pass weighs it all up.'
            : 'A fixed pipeline: read the email, confirm the company, then one quick search for red flags. Every claim is checked against what the search actually returned.'}
        </p>
        <p className="mt-3 t-micro text-ink-3">
          {run.mode === 'deep' ? 'Full research' : 'Quick check'}, started {started} UTC
        </p>
      </header>

      <dl className="card mt-8 grid grid-cols-2 gap-px overflow-hidden bg-line-soft p-0 sm:grid-cols-5">
        {[
          ['Time', duration(total)],
          ['Model calls', totals.calls ? n(totals.calls) : '–'],
          ['Web searches', n(run.searches)],
          ['Pages cited', totals.found ? `${n(totals.cited)} of ${n(totals.found)}` : '–'],
          ['Cost', usd(run.cost_usd)],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3.5 last:col-span-2 sm:last:col-span-1">
            <dt className="t-micro text-ink-3">{k}</dt>
            <dd className="mt-0.5 text-[17px] font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="timeline" className="card mt-4 p-5 sm:p-6">
        <h2 id="timeline" className="font-semibold">
          Timeline
        </h2>
        <p className="mt-0.5 t-small text-ink-3">Bars that overlap ran at the same time.</p>
        <ol className="mt-5 space-y-2">
          {rows.map((r) => (
            <li key={r.stage} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,13rem)_1fr]">
              <span className="truncate t-micro text-ink-2" title={stageLabel(r.stage)}>
                {stageLabel(r.stage)}
              </span>
              <span className="relative h-5 rounded-[5px] bg-sunken">
                <span
                  className="absolute inset-y-0 rounded-[5px]"
                  style={{ left: `${(r.start / span) * 100}%`, width: `max(4px, ${((r.end - r.start) / span) * 100}%)`, background: STATUS[r.status].bar }}
                />
                <span className="sr-only">
                  {STATUS[r.status].label}, from {duration(r.start)} to {duration(r.end)}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-2 grid grid-cols-[minmax(0,9rem)_1fr] gap-3 sm:grid-cols-[minmax(0,13rem)_1fr]" aria-hidden>
          <span />
          <span className="relative h-4">
            {ticks(span).map((t, i, all) => (
              // On a phone, every other label, so they never run together.
              <span key={t} className={`absolute -translate-x-1/2 t-micro tabular-nums text-ink-3 first:translate-x-0 ${all.length > 4 && i % 2 ? 'max-sm:hidden' : ''}`} style={{ left: `${(t / span) * 100}%` }}>
                {clock(t)}
              </span>
            ))}
          </span>
        </div>
      </section>

      {totals.calls > 0 && (
        <section aria-labelledby="guardrails" className="card mt-4 p-5 sm:p-6">
          <h2 id="guardrails" className="font-semibold">
            What the checks caught
          </h2>
          <p className="mt-0.5 t-small text-ink-3">Code, not the model, enforces these. A claim without a source the search returned does not reach the report.</p>
          <ul className="mt-3 grid divide-line-soft sm:grid-cols-2 sm:gap-x-8">
            <Fact value={totals.removedCitations} label="citations removed, because the search never returned that page" tone="text-amber" />
            <Fact value={totals.droppedClaims} label="claims dropped for having no source left" tone="text-amber" />
            <Fact value={totals.retries} label="answers that failed the checks and were redone" tone="text-amber" />
            <Fact value={totals.suspect} label="web quotes that read like instructions to an AI, ignored" tone="text-risk" />
            <Fact value={totals.capped} label="stages that hit their search limit" tone="text-amber" />
          </ul>
        </section>
      )}

      <section aria-labelledby="steps" className="mt-12">
        <h2 id="steps" className="t-title">
          Step by step
        </h2>
        {totals.calls === 0 && <p className="mt-1 t-small text-ink-3">This run came before Backchannel kept each call, so only its stages are shown.</p>}
        <ol className="mt-5 space-y-3">
          {rows.map((r) => (
            <li key={r.stage} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <h3 className="font-semibold">{stageLabel(r.stage)}</h3>
                <span className="flex items-center gap-3 t-micro tabular-nums text-ink-3">
                  {duration(r.end - r.start)}
                  {r.usd > 0 && `, ${usd(r.usd)}`}
                  <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS[r.status].chip}`}>{STATUS[r.status].label}</span>
                </span>
              </div>
              {r.error && <p className="mt-2 rounded-[8px] bg-risk-soft px-3 py-2 t-micro whitespace-pre-line text-risk">{r.error}</p>}
              {r.calls.length > 0 && (
                <ol className="mt-1 divide-y divide-line-soft">
                  {r.calls.map((c, i) => (
                    <Call key={i} c={c} />
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      </section>
    </article>
  )
}
