'use client'

import type { ReactNode } from 'react'
import { roleTitle } from '../../../src/report/markdown'
import type { AiStance, CompanyResearch, ContactRelation } from '../../../src/types/research'
import { ownershipLabel } from '../../_lib/format'
import { linkedinSearch, profileUrl, roleSearches } from '../../_lib/linkedin'
import { Cites, Confidence } from '../Evidence'
import { Monogram } from '../Monogram'
import { Claims, Fact, Facts, n, NotYet, Section, Timeline, urls, type C } from './kit'

type R = CompanyResearch
type Deep = { onDeep?: () => void; running: boolean }

function Lede<T>({ c, empty }: { c: C<T> | null; empty: string }) {
  if (!c) return <p className="t-small text-ink-3">{empty}</p>
  return (
    <p className="t-lede max-w-[46ch]">
      {String(c.value)}
      <Cites urls={urls(c)} />
    </p>
  )
}

/** What they do: the business in plain words, what they sell, to whom, and against whom. */
export function CompanyTab({ r, ...deep }: { r: R } & Deep) {
  const b = r.business
  const id = r.identity
  return (
    <div className="space-y-12">
      {b ? (
        <>
          <section aria-label="What they do">
            <Lede c={b.summary} empty="What the company does could not be established from sources." />
          </section>
          <Section title="What they sell" id="products">
            {b.products.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {b.products.map((c, i) => (
                  <li key={i} className="card p-4">
                    <p className="font-semibold">{c.value.name}</p>
                    <p className="mt-1 t-small text-ink-2">
                      {c.value.description}
                      <Cites urls={urls(c)} />
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-small text-ink-3">No products were named in sources.</p>
            )}
          </Section>
          <Section title="How it makes money" id="model">
            <Facts>
              <Fact label="Customers" c={b.customers} />
              <Fact label="Business model" c={b.business_model} />
            </Facts>
          </Section>
          <Section title="Up against" id="competitors">
            {b.competitors.length ? (
              <ul className="flex flex-wrap gap-2">
                {b.competitors.map((c, i) => (
                  <li key={i} className="inline-flex h-9 items-center gap-2 rounded-full bg-surface pr-3 pl-1.5 t-small font-medium shadow-[var(--shadow-1)]">
                    <Monogram name={c.value} size={24} />
                    {c.value}
                    <Cites urls={urls(c)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-small text-ink-3">No competitors named by independent sources.</p>
            )}
          </Section>
        </>
      ) : (
        <NotYet what="What the company sells, to whom, how it makes money and who it competes with." {...deep} />
      )}

      <Section title="The basics" id="basics">
        <Facts>
          <Fact label="Legal name" c={id.legal_name} />
          <Fact label="Headquarters" c={id.hq} />
          <Fact label="Founded" c={id.founded_year} />
          <Fact label="Listed" c={id.is_public} show={(v) => (v ? 'Publicly listed' : 'Private')} />
        </Facts>
      </Section>

      <Section title="The role" id="role">
        <dl className="card px-5">
          {[
            ['Title', roleTitle(r.role.level_claimed, r.role.title) || 'Not stated'],
            ['Location', r.role.location ?? 'Not stated'],
            ['Work policy', r.role.work_policy === 'unknown' ? 'Not stated' : r.role.work_policy],
            ['Employment', r.role.employment_type === 'unknown' ? 'Not stated' : r.role.employment_type],
            ['Experience asked', r.role.required_years ?? 'Not stated'],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-1 border-b border-line-soft py-3.5 last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-6">
              <dt className="t-small text-ink-3">{k}</dt>
              <dd className="first-letter:uppercase">{v}</dd>
            </div>
          ))}
        </dl>
        {r.role.extracted_requirements.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {r.role.extracted_requirements.map((q) => (
              <li key={q} className="rounded-full bg-sunken px-3 py-1 t-small text-ink-2">
                {q}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function External() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path d="M4 2H2.5A.5.5 0 0 0 2 2.5v5a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5V6M6 2h2v2M8 2 4.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A profile link when search returned one for this person; otherwise a LinkedIn search you run yourself. */
function ProfileLink({ name, company, evidence }: { name: string; company: string; evidence: { url: string }[] }) {
  const url = profileUrl(evidence)
  return (
    <a
      href={url ?? linkedinSearch(`${name} ${company}`)}
      target="_blank"
      rel="noreferrer"
      className="relative z-10 mt-2 inline-flex items-center gap-1.5 t-micro font-semibold text-accent hover:underline"
    >
      {url ? 'LinkedIn profile' : 'Find on LinkedIn'}
      <External />
    </a>
  )
}

function PersonCard({ p, c, company, badge }: { p: { name: string; role: string; background: string | null; since: string | null }; c: C<unknown>; company: string; badge?: ReactNode }) {
  return (
    <li className="card flex gap-3.5 p-4">
      <Monogram name={p.name} size={40} />
      <div className="min-w-0">
        <p className="font-semibold">
          {p.name}
          <Cites urls={urls(c)} />
        </p>
        <p className="t-small text-ink-2">
          {p.role}
          {p.since && <span className="text-ink-3"> since {p.since}</span>}
        </p>
        {p.background && <p className="mt-1.5 t-small text-ink-3">{p.background}</p>}
        <div className="flex flex-wrap items-center gap-x-3">
          {badge}
          <ProfileLink name={p.name} company={company} evidence={c.evidence} />
        </div>
      </div>
    </li>
  )
}

const RELATION: Record<ContactRelation, string> = {
  hiring_manager: 'Likely hiring manager',
  leadership_above_role: 'Leadership above the role',
  recruiter: 'Recruiter',
  team: 'On the team',
}

/** The few people tied to this role, and LinkedIn searches to find the rest yourself. */
function PeopleToKnow({ r, ...deep }: { r: R } & Deep) {
  const company = r.identity.display_name
  const searches = roleSearches(company, r.role)
  return (
    <Section title="People to know for this role" aside="From public search results" id="contacts">
      {r.contacts === null ? (
        <p className="t-small text-ink-3">
          Not researched for this report.{' '}
          {deep.onDeep && !deep.running && (
            <button className="font-semibold text-accent hover:underline" onClick={deep.onDeep}>
              Run full research again
            </button>
          )}{' '}
          to look for the likely hiring manager and the leadership above the role.
        </p>
      ) : r.contacts.length === 0 ? (
        <p className="t-small text-ink-3">Nobody tied to this role turned up in public sources. The searches below are the next best thing.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {r.contacts.map((c, i) => (
            <li key={i} className="card flex gap-3.5 p-4">
              <Monogram name={c.value.name} size={40} />
              <div className="min-w-0">
                <p className="t-micro font-medium text-ink-3">{RELATION[c.value.relation]}</p>
                <p className="font-semibold">
                  {c.value.name}
                  <Cites urls={urls(c)} />
                </p>
                {c.value.title && <p className="t-small text-ink-2">{c.value.title}</p>}
                <p className="mt-1.5 t-small text-ink-3">{c.value.why}</p>
                <div className="flex flex-wrap items-center gap-x-3">
                  <span
                    className={`mt-2 inline-block rounded-full px-2 py-0.5 t-micro font-medium ${c.value.match === 'confirmed' ? 'bg-green-soft text-green' : 'bg-amber-soft text-amber'}`}
                    title={c.value.match === 'confirmed' ? 'A source names this person with this company and title' : 'The link to this company or role is weaker: check before reaching out'}
                  >
                    {c.value.match === 'confirmed' ? 'Confirmed match' : 'Possible match'}
                  </span>
                  <ProfileLink name={c.value.name} company={company} evidence={c.evidence} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5">
        <p className="t-small font-medium">Search LinkedIn yourself</p>
        <p className="t-micro text-ink-3">Opens in your own LinkedIn, with mutual connections and who to message.</p>
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {searches.map((q) => (
            <li key={q.keywords}>
              <a
                href={linkedinSearch(q.keywords)}
                target="_blank"
                rel="noreferrer"
                title={q.keywords}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 t-small font-medium shadow-[var(--shadow-1)] transition-colors duration-100 hover:text-accent"
              >
                {q.label}
                <External />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

/** Who started it, who runs it now, and how the people inside are doing. */
export function PeopleTab({ r, ...deep }: { r: R } & Deep) {
  const b = r.business
  const p = r.people
  const company = r.identity.display_name
  return (
    <div className="space-y-12">
      <PeopleToKnow r={r} {...deep} />
      {b ? (
        <>
          <Section title="Founders" id="founders">
            {b.founders.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {b.founders.map((c, i) => (
                  <PersonCard
                    key={i}
                    p={c.value}
                    c={c}
                    company={company}
                    badge={
                      c.value.still_involved !== null && (
                        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 t-micro font-medium ${c.value.still_involved ? 'bg-green-soft text-green' : 'bg-sunken text-ink-3'}`}>
                          {c.value.still_involved ? 'Still involved' : 'No longer involved'}
                        </span>
                      )
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="t-small text-ink-3">Founders were not named in sources.</p>
            )}
          </Section>
          <Section title="Who runs it now" id="leaders">
            {b.leaders.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {b.leaders.map((c, i) => (
                  <PersonCard key={i} p={c.value} c={c} company={company} />
                ))}
              </ul>
            ) : (
              <p className="t-small text-ink-3">Current leaders were not named in sources.</p>
            )}
          </Section>
        </>
      ) : (
        <NotYet what="Founders and their backgrounds, and who leads the company, product, design and engineering today." {...deep} />
      )}

      <Section title="Leadership changes" aside="Last two years" id="changes">
        <Timeline items={p.leadership_changes} date={(v) => v.date} empty="No leadership changes found.">
          {(v) => (
            <>
              <span className="font-medium">{v.role}</span>
              <span className="text-ink-2">
                {v.direction === 'appointment' ? ' appointed' : v.direction === 'departure' ? ' departed' : ' in transition'}
                {v.person_in && `: ${v.person_in} in`}
                {v.person_out && `${v.person_in ? ',' : ':'} ${v.person_out} out`}
              </span>
            </>
          )}
        </Timeline>
      </Section>

      <div className="grid gap-12 md:grid-cols-2 md:gap-8">
        <Section title="Layoffs" aside="Last four years" id="layoffs">
          <Timeline items={p.layoff_events} date={(v) => v.date} empty="No layoffs found in the sources.">
            {(v) => (
              <>
                <span className="font-medium">{[v.headcount !== null && `${n(v.headcount)} people`, v.percentage !== null && `${v.percentage}%`].filter(Boolean).join(', ') || 'Layoff'}</span>
                {v.scope && <span className="text-ink-2">, {v.scope}</span>}
                {v.handling_notes && <span className="block t-small text-ink-3">{v.handling_notes}</span>}
              </>
            )}
          </Timeline>
        </Section>
        <Section title="Size" id="size">
          <Facts>
            <Fact label="Headcount" c={p.headcount} show={(v) => <span className="tabular-nums">{n(v)}</span>} />
            <Fact
              label="Over time"
              c={p.headcount_trend}
              show={(t) => (
                <span className="tabular-nums">
                  {t.map((x) => (
                    <span key={x.year} className="mr-3 inline-block">
                      <span className="text-ink-3">{x.year}</span> {n(x.count)}
                    </span>
                  ))}
                </span>
              )}
            />
          </Facts>
        </Section>
      </div>

      <Section title="What employees say" id="reviews">
        {p.review_scores.length ? (
          <ul className="grid gap-2 sm:grid-cols-3">
            {p.review_scores.map((c, i) => (
              <li key={i} className="card p-4">
                <p className="t-small text-ink-3">{c.value.source}</p>
                <p className="mt-1 t-display tabular-nums">
                  {c.value.score}
                  <span className="t-small font-normal text-ink-3"> of {c.value.scale}</span>
                  <Cites urls={urls(c)} />
                </p>
                <p className="mt-1 t-micro text-ink-3">
                  {c.value.sample_size !== null ? `${n(c.value.sample_size)} reviews` : 'Sample size not shown'}
                  {c.value.trend !== 'unknown' && `, ${c.value.trend}`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-small text-ink-3">No review scores found.</p>
        )}
        <p className="mt-3 t-micro text-ink-3">Review data is self-selected and skews negative. Read the sample size before the score.</p>
      </Section>
    </div>
  )
}

/** Who owns it and whether the money is there: the part that decides how secure the job is. */
export function MoneyTab({ r }: { r: R }) {
  const m = r.money
  return (
    <div className="space-y-12">
      <section aria-label="Ownership">
        {m.ownership_type ? (
          <p className="t-lede">
            {ownershipLabel(m.ownership_type.value)}
            <Cites urls={urls(m.ownership_type)} />
            <span className="mt-1 block">
              <Confidence level={m.ownership_type.confidence} />
            </span>
          </p>
        ) : (
          <p className="t-small text-ink-3">Ownership could not be established from sources.</p>
        )}
      </section>
      <Section title="Revenue and profit" id="revenue">
        <Facts>
          <Fact label="Revenue" c={m.revenue_signal} />
          <Fact label="Profitability" c={m.profitability} />
        </Facts>
      </Section>
      <Section title="Funding and ownership events" id="funding">
        <Timeline items={m.funding_events} date={(v) => v.date} empty="No funding or ownership events found.">
          {(v) => (
            <>
              <span className="font-medium">{v.round ?? 'Event'}</span>
              {/* Shown as reported: a converted figure would be a number we made up. */}
              {v.amount !== null && v.currency && (
                <span className="tabular-nums text-ink-2">
                  , {n(v.amount)} {v.currency}
                </span>
              )}
              {v.investors.length > 0 && <span className="block t-small text-ink-3">{v.investors.join(', ')}</span>}
            </>
          )}
        </Timeline>
      </Section>
      <Section title="Sale, IPO and acquisitions" id="exits">
        <Claims items={m.exit_activity} empty="No sale, IPO or acquisition activity found.">
          {(v) => v}
        </Claims>
      </Section>
    </div>
  )
}

const STANCES: { value: AiStance; label: string; hint: string }[] = [
  { value: 'none', label: 'None', hint: 'No AI work evident' },
  { value: 'ai_peripheral', label: 'Peripheral', hint: 'AI at the edges' },
  { value: 'ai_adopting', label: 'Adopting', hint: 'Adding AI to products or operations' },
  { value: 'ai_core', label: 'Core', hint: 'AI is central to the product' },
  { value: 'ai_native', label: 'Native', hint: 'AI is the product' },
]

/** Where the company stands on AI, as its own products and statements show it. */
export function AiTab({ r, ...deep }: { r: R } & Deep) {
  const k = r.market
  if (!k) return <NotYet what="How central AI is to the company, its AI products and partnerships, and what it has shipped versus announced." {...deep} />
  const at = k.ai_stance ? STANCES.findIndex((s) => s.value === k.ai_stance!.value) : -1 // non-null: checked in the same expression
  return (
    <div className="space-y-12">
      <section aria-labelledby="stance" className="card p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="stance" className="font-semibold">
            How central AI is
          </h2>
          {k.ai_stance && (
            <span className="flex items-center gap-2">
              <Confidence level={k.ai_stance.confidence} />
              <Cites urls={urls(k.ai_stance)} />
            </span>
          )}
        </div>
        <ol className="mt-5 grid grid-cols-5 gap-1.5" aria-label={at >= 0 ? `AI stance: ${STANCES[at]!.label}` : 'AI stance not established'}>
          {STANCES.map((s, i) => (
            <li key={s.value} className="min-w-0">
              <span className={`block h-2 rounded-full transition-colors duration-300 ${at >= 0 && i <= at ? 'bg-accent' : 'bg-sunken'}`} style={{ opacity: at >= 0 && i <= at ? 0.35 + (i / 4) * 0.65 : 1 }} />
              <span className={`mt-2 block truncate t-small ${i === at ? 'font-semibold text-ink' : 'text-ink-3'}`}>{s.label}</span>
              <span className="hidden truncate t-micro text-ink-3 sm:block">{s.hint}</span>
            </li>
          ))}
        </ol>
        {at < 0 && <p className="mt-4 t-small text-ink-3">Sources did not show how central AI is to the company.</p>}
      </section>
      <section aria-label="AI summary">
        <Lede c={k.ai_summary} empty="No summary of the company’s AI work could be sourced." />
      </section>
      <Section title="What they have shipped and announced" id="initiatives">
        <Timeline items={k.ai_initiatives} date={(v) => v.date} empty="No AI products, partnerships or investments found.">
          {(v) => (
            <>
              <span className="font-medium">{v.title}</span>
              <span className="block t-small text-ink-2">{v.detail}</span>
            </>
          )}
        </Timeline>
      </Section>
    </div>
  )
}

/** Where it is heading: our read, clearly marked as one, then the sourced signals behind it. */
export function OutlookTab({ r, ...deep }: { r: R } & Deep) {
  const k = r.market
  if (!k) return <NotYet what="The company’s stated direction, notable news from the last year, and the tailwinds and headwinds in its market." {...deep} />
  return (
    <div className="space-y-12">
      {r.outlook && (
        <section aria-labelledby="read" className="rounded-[16px] border-l-[3px] border-accent bg-accent-soft/50 py-5 pr-5 pl-6">
          <h2 id="read" className="t-small font-semibold text-accent">
            Our read
          </h2>
          <p className="mt-2 max-w-[62ch] t-lede">{r.outlook}</p>
          <p className="mt-3 t-micro text-ink-3">A judgement drawn from the sourced research on this page, not a fact.</p>
        </section>
      )}
      <Section title="Their stated direction" id="strategy">
        <Facts>
          <Fact label="Strategy" c={k.strategy} />
        </Facts>
      </Section>
      <Section title="In the news" aside="Last 12 months" id="news">
        <Timeline items={k.recent_news} date={(v) => v.date} empty="No notable news found.">
          {(v) => <span className="font-medium">{v.headline}</span>}
        </Timeline>
      </Section>
      <div className="grid gap-8 md:grid-cols-2">
        <Section title="Tailwinds" id="tailwinds">
          <Claims items={k.tailwinds} empty="None found.">
            {(v) => v}
          </Claims>
        </Section>
        <Section title="Headwinds" id="headwinds">
          <Claims items={k.headwinds} empty="None found.">
            {(v) => v}
          </Claims>
        </Section>
      </div>
    </div>
  )
}
