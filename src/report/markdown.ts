import { collectEvidenceUrls } from '../llm/evidence'
import type { CompanyResearch, EvidenceRef, Flag, Score, TriageResult } from '../types/research'

type C<T> = { value: T; confidence: string; evidence: EvidenceRef[] }

/** 'Lead' + 'Lead Product Designer' must not read 'Lead Lead Product Designer'. */
export const roleTitle = (level: string | null, title: string) =>
  level && !title.toLowerCase().split(/\s+/).includes(level.toLowerCase()) ? `${level} ${title}` : title

const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
const num = (n: number) => n.toLocaleString('en-US')
const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join('\n') : 'None found.')

export function toMarkdown(r: CompanyResearch): string {
  // Sources are numbered once, in order of first use across the whole report.
  const index = new Map(collectEvidenceUrls(r).map((u, i) => [u, i + 1]))
  const sources = new Map<string, EvidenceRef>()
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(visit)
    if (typeof v !== 'object' || v === null) return
    const o = v as Record<string, unknown>
    if (typeof o.url === 'string' && typeof o.trust_tier === 'string' && !sources.has(o.url)) sources.set(o.url, o as unknown as EvidenceRef)
    Object.values(o).forEach(visit)
  }
  visit(r)

  const refs = (urls: string[]) => (urls.length ? ' ' + [...new Set(urls)].map((u) => `[${index.get(u)}]`).join('') : '')
  const claim = <T>(c: C<T> | null, show: (v: T) => string = String) =>
    c ? `${show(c.value)} (${c.confidence})${refs(c.evidence.map((e) => e.url))}` : 'Not established'
  const claims = <T>(cs: C<T>[], show: (v: T) => string) => list(cs.map((c) => claim(c, show)))

  const flag = (f: Flag) =>
    `- **${f.title}** (${label(f.kind)}, severity ${f.severity})${f.basis === 'profile' ? ', from your profile' : refs(f.evidence.map((e) => e.url))}\n  ${f.detail}`
  const flags = (p: Flag['polarity']) => {
    const fs = r.flags.filter((f) => f.polarity === p).sort((a, b) => b.severity - a.severity)
    return fs.length ? fs.map(flag).join('\n') : 'None found.'
  }
  const score = (s: Score) => `| ${label(s.dimension)} | ${s.unknown ? 'Unknown' : Math.round(s.value)} | ${s.rationale}${refs(s.evidence_urls)} |`

  const { identity: id, money, people, role, run, business: biz, market: mkt } = r
  const person = (p: { name: string; role: string; since: string | null; background: string | null; still_involved?: boolean | null }) =>
    [p.name, p.role, p.since && `since ${p.since}`, p.still_involved === true ? 'still involved' : p.still_involved === false ? 'no longer involved' : null, p.background]
      .filter(Boolean)
      .join(', ')
  const questions = r.questions.length
    ? r.questions.map((q, i) => `${i + 1}. ${q.question}\n   Why: ${q.why}`).join('\n')
    : r.questions_to_ask.map((q, i) => `${i + 1}. ${q}`).join('\n') || 'None generated.'
  const RELATION = { hiring_manager: 'likely hiring manager', leadership_above_role: 'leadership above the role', recruiter: 'recruiter', team: 'on the team' } as const
  const contactsSection = r.contacts
    ? `
## People to know

${
  r.contacts
    .map((c) => {
      const p = c.value
      const profile = c.evidence.find((e) => /linkedin\.com\/in\//.test(e.url))?.url
      return `- ${[p.name, p.title, RELATION[p.relation], `${p.match} match`].filter(Boolean).join(', ')}${refs(c.evidence.map((e) => e.url))}\n  ${p.why}${profile ? `\n  Profile: ${profile}` : ''}`
    })
    .join('\n') || 'Nobody tied to this role could be found in public sources.'
}
`
    : ''
  const businessSection = biz
    ? `
## What they do

${claim(biz.summary)}

- Customers: ${claim(biz.customers)}
- Business model: ${claim(biz.business_model)}

### Products

${claims(biz.products, (p) => `${p.name}: ${p.description}`)}

### Competitors

${claims(biz.competitors, String)}

### Founders

${claims(biz.founders, person)}

### Leadership

${claims(biz.leaders, person)}
`
    : ''
  const marketSection = mkt
    ? `
## AI

- Stance: ${claim(mkt.ai_stance, (v) => label(v).replace(/^Ai/, 'AI'))}
- ${claim(mkt.ai_summary)}

${claims(mkt.ai_initiatives, (a) => [a.date, a.title, a.detail].filter(Boolean).join(': '))}

## Outlook

${r.outlook ? `Our read: ${r.outlook}\n\n` : ''}- Strategy: ${claim(mkt.strategy)}

### Recent news

${claims(mkt.recent_news, (n) => (n.date ? `${n.date}: ${n.headline}` : n.headline))}

### Tailwinds

${claims(mkt.tailwinds, String)}

### Headwinds

${claims(mkt.headwinds, String)}
`
    : ''
  const meta = [
    r.generated_at.slice(0, 10),
    run.mode,
    r.partial ? '**partial: some stages did not complete**' : 'complete',
    `$${run.cost_usd.toFixed(2)}`,
    `${run.searches_used} searches`,
    `${Math.round(run.duration_ms / 1000)}s`,
  ].join(' · ')

  return `# ${id.display_name}: ${role.title}

> ${meta}

## Verdict

${r.verdict || 'Not available.'}

## Scores

| Dimension | Score | Why |
|---|---|---|
${r.scores.map(score).join('\n') || '| (none) | | |'}

## Risk flags

${flags('risk')}

## Green flags

${flags('green')}

## Questions to ask

${questions}
${businessSection}${contactsSection}${marketSection}
## Company

- Legal name: ${claim(id.legal_name)}
- Domain: ${id.domain} (resolution confidence ${id.resolution_confidence})
- Headquarters: ${claim(id.hq)}
- Founded: ${claim(id.founded_year)}
- Public: ${claim(id.is_public, (v) => (v ? 'yes' : 'no'))}

## Money

- Ownership: ${claim(money.ownership_type, label)}
- Revenue: ${claim(money.revenue_signal)}
- Profitability: ${claim(money.profitability)}

### Funding events

${claims(money.funding_events, (f) => [f.date, f.round, f.amount !== null && f.currency ? `${num(f.amount)} ${f.currency}` : null, f.investors.length ? `investors: ${f.investors.join(', ')}` : null].filter(Boolean).join(', '))}

### Exit activity

${claims(money.exit_activity, String)}

## People

- Headcount: ${claim(people.headcount, num)}
- Headcount trend: ${claim(people.headcount_trend, (t) => t.map((p) => `${p.year}: ${num(p.count)}`).join(', '))}

### Layoffs

${claims(people.layoff_events, (l) => [l.date, l.headcount !== null ? `${num(l.headcount)} people` : null, l.percentage !== null ? `${l.percentage}%` : null, l.scope, l.handling_notes].filter(Boolean).join(', '))}

## Leadership changes

${claims(people.leadership_changes, (l) => [l.date, l.role, l.direction, l.person_in && `in: ${l.person_in}`, l.person_out && `out: ${l.person_out}`].filter(Boolean).join(', '))}

## Employee reviews

${claims(people.review_scores, (s) => `${s.source}: ${s.score}/${s.scale}${s.sample_size !== null ? ` from ${num(s.sample_size)} reviews` : ''}, trend ${s.trend}${s.as_of ? `, as of ${s.as_of}` : ''}`)}

## Role

- ${roleTitle(role.level_claimed, role.title)}, ${role.location ?? 'location not stated'}, ${role.work_policy}, ${role.employment_type}
${role.extracted_requirements.map((q) => `- ${q}`).join('\n')}

## What we could not establish

${list(r.gaps)}

## Sources

${[...index.keys()].map((u) => {
    const s = sources.get(u)
    return `${index.get(u)}. [${s?.title ?? u}](${u})${s ? ` · ${[s.publisher, s.published_at, s.trust_tier].filter(Boolean).join(' · ')}` : ''}`
  }).join('\n') || 'None.'}

Run: ${Object.entries(run.stage_status).map(([k, v]) => `${k} ${v}`).join(', ')}
`
}

export function triageToMarkdown(t: TriageResult): string {
  const index = new Map(collectEvidenceUrls(t).map((u, i) => [u, i + 1]))
  const refs = (urls: string[]) => (urls.length ? ' ' + [...new Set(urls)].map((u) => `[${index.get(u)}]`).join('') : '')
  const flags = t.flags.length
    ? [...t.flags].sort((a, b) => b.severity - a.severity).map((f) => `- ${f.polarity === 'risk' ? 'Risk' : 'Green'}: **${f.title}** (severity ${f.severity})${refs(f.evidence.map((e) => e.url))}\n  ${f.detail}`).join('\n')
    : 'None found.'
  return `# ${t.identity.display_name}: ${t.role.title} (quick check)

> ${t.generated_at.slice(0, 10)} · ${t.partial ? '**partial**' : 'complete'} · $${t.run.cost_usd.toFixed(2)} · ${t.run.searches_used} searches

**${t.deep_dive.recommended ? 'Worth a deep dive.' : 'Probably not worth a deep dive.'}** ${t.deep_dive.reason}

## Flags

${flags}

## What the quick check could not establish

${list(t.gaps)}

## Sources

${[...index.keys()].map((u) => `${index.get(u)}. ${u}`).join('\n') || 'None.'}
`
}
