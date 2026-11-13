import Link from 'next/link'
import { list, type Summary } from '../src/server/api'
import { requireOwner } from './_lib/session'
import { age, flagLabel, stageLabel } from './_lib/format'
import { AutoRefresh } from './_ui/AutoRefresh'
import { Intake } from './_ui/Intake'
import { ScoreGlyph } from './_ui/ScoreGlyph'

export const dynamic = 'force-dynamic'

export default async function Inbox() {
  const items = (await list(await requireOwner())).body as Summary[]
  return (
    <>
      <AutoRefresh active={items.some((o) => o.status === 'running')} />
      <section className="pt-14 pb-10 sm:pt-20">
        <h1 className="t-display max-w-[16ch]">Know the company before the first call.</h1>
        <p className="t-lede mt-3 max-w-[38ch] text-ink-2">Paste what the recruiter sent. Every finding comes back with the source behind it.</p>
        <div className="mt-8">
          <Intake />
        </div>
      </section>

      <section aria-labelledby="inbox-heading">
        <div className="flex items-baseline justify-between border-b border-line-soft pb-2">
          <h2 id="inbox-heading" className="t-small font-semibold text-ink">
            Opportunities
          </h2>
          {items.length > 0 && <span className="t-micro tabular-nums text-ink-3">{items.length}</span>}
        </div>
        {items.length === 0 ? (
          <p className="py-10 t-small text-ink-3">Nothing here yet. Paste your next recruiter email above to research the company behind it.</p>
        ) : (
          <ul>
            {items.map((o) => (
              <Row key={o.id} o={o} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function Row({ o }: { o: Summary }) {
  return (
    <li className="border-b border-line-soft">
      <Link
        href={`/o/${o.id}`}
        className="group -mx-3 grid grid-cols-[1fr_auto] items-start gap-x-6 gap-y-1 rounded-xl px-3 py-4 transition-colors duration-150 hover:bg-sunken/70 sm:grid-cols-[minmax(0,15rem)_1fr_auto]"
      >
        <div className="col-start-1 row-start-1 min-w-0">
          <p className="truncate font-semibold tracking-[-0.022em]">{o.company ?? 'Reading the email…'}</p>
          <p className="truncate t-small text-ink-2">{o.role ?? ' '}</p>
        </div>
        <div className="col-span-2 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <Status o={o} />
          {o.flags.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 t-micro text-ink-2">
              {o.flags.map((f) => (
                <span key={f.kind} className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.polarity === 'risk' ? 'var(--risk)' : 'var(--green)' }} aria-hidden />
                  {flagLabel(f.kind)}
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="col-start-2 row-start-1 flex flex-col items-end gap-1.5 sm:col-start-3">
          <ScoreGlyph scores={o.scores} />
          <span className="t-micro text-ink-3">{age(o.created_at)}</span>
        </div>
      </Link>
    </li>
  )
}

function Status({ o }: { o: Summary }) {
  if (o.status === 'running')
    return (
      <p className="flex items-center gap-2 t-small text-ink-2">
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/50" />
          <span className="relative h-2 w-2 rounded-full bg-accent" />
        </span>
        {o.stage ? stageLabel(o.stage) : 'Starting'}
      </p>
    )
  if (o.status === 'needs_choice') return <p className="t-small font-medium text-amber">Needs you: which company is this?</p>
  if (o.status === 'failed') return <p className="t-small text-risk">Research stopped. Open to see why.</p>
  if (!o.headline) return null
  return (
    <p className="line-clamp-2 t-small text-ink">
      {o.depth === 'triage' && (
        <span className={`mr-1.5 font-medium ${o.recommendation === 'deep' ? 'text-accent' : 'text-ink-3'}`}>
          {o.recommendation === 'deep' ? 'Worth a closer look.' : 'Probably skip.'}
        </span>
      )}
      {o.headline}
    </p>
  )
}
