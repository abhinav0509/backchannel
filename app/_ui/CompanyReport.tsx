'use client'

import type { ReactNode } from 'react'
import type { CompanyResearch, EvidenceRef } from '../../src/types/research'
import { roleTitle } from '../../src/report/markdown'
import { ownershipLabel } from '../_lib/format'
import { Gaps } from './Decision'
import { Cites, Confidence } from './Evidence'

type C<T> = { value: T; confidence: 'confirmed' | 'reported' | 'unverified'; evidence: EvidenceRef[]; as_of: string | null; note?: string }

const n = (x: number) => x.toLocaleString('en-US')
const when = (d: string | null) => d ?? 'Date unknown'

function Claim<T>({ label, c, show = String }: { label: string; c: C<T> | null; show?: (v: T) => ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line-soft py-3.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="t-small text-ink-3">{label}</dt>
      <dd>
        {c ? (
          <>
            <span>{show(c.value)}</span>
            <Cites urls={c.evidence.map((e) => e.url)} />
            <span className="mt-1 flex flex-wrap items-center gap-x-3">
              <Confidence level={c.confidence} />
              {c.as_of && <span className="t-micro text-ink-3">As of {c.as_of}</span>}
            </span>
            {c.note && <span className="mt-1 block t-small text-ink-3">{c.note}</span>}
          </>
        ) : (
          <span className="text-ink-3">Not established</span>
        )}
      </dd>
    </div>
  )
}

function Events<T>({ title, items, show, empty }: { title: string; items: C<T>[]; show: (v: T) => ReactNode; empty: string }) {
  return (
    <div className="mt-8">
      <h3 className="font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 t-small text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-2">
          {items.map((c, i) => (
            <li key={i} className="border-b border-line-soft py-3">
              {show(c.value)}
              <Cites urls={c.evidence.map((e) => e.url)} />
              <span className="mt-1 block">
                <Confidence level={c.confidence} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="t-title">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function CompanyReport({ r }: { r: CompanyResearch }) {
  const { identity: id, money, people, role } = r
  return (
    <div className="max-w-[760px] space-y-16">
      <Section title="Company">
        <dl className="border-t border-line-soft">
          <Claim label="Legal name" c={id.legal_name} />
          <Claim label="Headquarters" c={id.hq} />
          <Claim label="Founded" c={id.founded_year} />
          <Claim label="Listed" c={id.is_public} show={(v) => (v ? 'Publicly listed' : 'Private')} />
        </dl>
      </Section>

      <Section title="Ownership and money">
        <dl className="border-t border-line-soft">
          <Claim label="Ownership" c={money.ownership_type} show={ownershipLabel} />
          <Claim label="Revenue" c={money.revenue_signal} />
          <Claim label="Profitability" c={money.profitability} />
        </dl>
        <Events
          title="Funding and ownership events"
          items={money.funding_events}
          empty="None found."
          show={(f) => (
            <>
              <span className="font-medium">{f.round ?? 'Event'}</span>
              <span className="text-ink-2">, {when(f.date)}</span>
              {f.amount !== null && f.currency && <span className="tabular-nums text-ink-2">, {n(f.amount)} {f.currency}</span>}
              {f.investors.length > 0 && <span className="block t-small text-ink-3">{f.investors.join(', ')}</span>}
            </>
          )}
        />
        <Events title="Sale, IPO and acquisition activity" items={money.exit_activity} empty="None found." show={(s) => s} />
      </Section>

      <Section title="People">
        <dl className="border-t border-line-soft">
          <Claim label="Headcount" c={people.headcount} show={(v) => <span className="tabular-nums">{n(v)}</span>} />
          <Claim
            label="Headcount over time"
            c={people.headcount_trend}
            show={(t) => (
              <span className="tabular-nums">
                {t.map((p) => (
                  <span key={p.year} className="mr-4 inline-block">
                    <span className="text-ink-3">{p.year}</span> {n(p.count)}
                  </span>
                ))}
              </span>
            )}
          />
        </dl>
        <Events
          title="Layoffs"
          items={people.layoff_events}
          empty="No layoffs found in the sources."
          show={(l) => (
            <>
              <span className="font-medium">{when(l.date)}</span>
              <span className="text-ink-2">
                {[l.headcount !== null && `${n(l.headcount)} people`, l.percentage !== null && `${l.percentage}%`, l.scope].filter(Boolean).map((x) => `, ${x}`)}
              </span>
              {l.handling_notes && <span className="block t-small text-ink-3">{l.handling_notes}</span>}
            </>
          )}
        />
        <Events
          title="Leadership changes"
          items={people.leadership_changes}
          empty="None found in the last two years."
          show={(c) => (
            <>
              <span className="font-medium">{c.role}</span>
              <span className="text-ink-2">
                , {c.direction}
                {c.person_in && `, ${c.person_in} in`}
                {c.person_out && `, ${c.person_out} out`}
              </span>
              <span className="block t-small text-ink-3">{when(c.date)}</span>
            </>
          )}
        />
        <Events
          title="Employee reviews"
          items={people.review_scores}
          empty="No review scores found."
          show={(s) => (
            <>
              <span className="font-medium">{s.source}</span>
              <span className="tabular-nums text-ink-2">
                , {s.score} of {s.scale}
                {s.sample_size !== null && ` from ${n(s.sample_size)} reviews`}
              </span>
              <span className="block t-small text-ink-3">
                {s.trend === 'unknown' ? 'Trend not shown in sources' : `Trend ${s.trend}`}
                {s.as_of && `, as of ${s.as_of}`}
              </span>
            </>
          )}
        />
        <p className="mt-4 t-micro text-ink-3">Review data is self-selected and tends to skew negative. Read sample sizes before scores.</p>
      </Section>

      <Section title="The role">
        <dl className="border-t border-line-soft">
          {[
            ['Title', roleTitle(role.level_claimed, role.title)],
            ['Location', role.location ?? 'Not stated'],
            ['Work policy', role.work_policy === 'unknown' ? 'Not stated' : role.work_policy],
            ['Employment', role.employment_type === 'unknown' ? 'Not stated' : role.employment_type],
            ['Experience asked', role.required_years ?? 'Not stated'],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-1 border-b border-line-soft py-3.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="t-small text-ink-3">{k}</dt>
              <dd className="first-letter:uppercase">{v}</dd>
            </div>
          ))}
        </dl>
        {role.extracted_requirements.length > 0 && (
          <ul className="mt-4 space-y-1.5 t-small text-ink-2">
            {role.extracted_requirements.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        )}
      </Section>

      <Gaps gaps={r.gaps} />
    </div>
  )
}
