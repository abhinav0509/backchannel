import { collectEvidenceUrls } from '../llm/evidence'
import type { ChangeItem, Changes, CompanyResearch, EvidenceRef } from '../types/research'

type Claimed<T> = { value: T; evidence: EvidenceRef[] }
type Section = ChangeItem['section']

const num = (n: number) => n.toLocaleString('en-US')

/**
 * The sourced items a report lists, each with a section, a title and a date. Comparing these is
 * what "what changed" means: a fact is new to us when none of its sources were in the last report.
 */
function items(r: CompanyResearch): { section: Section; title: string; date: string | null; urls: string[] }[] {
  const out: { section: Section; title: string; date: string | null; urls: string[] }[] = []
  const add = <T>(section: Section, list: Claimed<T>[] | undefined, title: (v: T) => string, date: (v: T) => string | null = () => null) => {
    for (const c of list ?? []) out.push({ section, title: title(c.value), date: date(c.value), urls: c.evidence.map((e) => e.url) })
  }
  add('money', r.money.funding_events, (f) => [f.round ?? 'Funding or ownership event', f.amount !== null && f.currency ? `${num(f.amount)} ${f.currency}` : null].filter(Boolean).join(', '), (f) => f.date)
  add('money', r.money.exit_activity, (s) => s)
  add('layoffs', r.people.layoff_events, (l) => `Layoff${l.headcount !== null ? ` of ${num(l.headcount)} people` : ''}${l.percentage !== null ? ` (${l.percentage}%)` : ''}${l.scope ? `, ${l.scope}` : ''}`, (l) => l.date)
  add('leadership', r.people.leadership_changes, (l) => [l.role, l.person_in && `${l.person_in} in`, l.person_out && `${l.person_out} out`].filter(Boolean).join(': '), (l) => l.date)
  add('leaders', r.business?.leaders, (p) => `${p.name}, ${p.role}`, (p) => p.since)
  add('news', r.market?.recent_news, (n) => n.headline, (n) => n.date)
  add('ai', r.market?.ai_initiatives, (a) => a.title, (a) => a.date)
  add('press', r.press?.coverage, (p) => (p.publisher ? `${p.title} (${p.publisher})` : p.title), (p) => p.date)
  add('press', r.press?.own, (p) => p.title, (p) => p.date)
  add('contacts', r.contacts ?? undefined, (p) => [p.name, p.title].filter(Boolean).join(', '))
  return out
}

/** A partial date (2026, 2026-11, 2026-11-10) falls after a moment only when its whole span does. */
const after = (date: string | null, since: string) => !!date && date > since.slice(0, date.length)

const ORDER: ChangeItem['kind'][] = ['new', 'moved', 'found', 'gone']

/** What the new research adds to, or takes from, the previous one. Deterministic: no model involved. */
export function diffReports(prev: CompanyResearch, next: CompanyResearch): Changes {
  const seen = new Set(collectEvidenceUrls(prev))
  const known = new Set(items(prev).map((i) => `${i.section}|${i.title.toLowerCase()}`))
  const changes: ChangeItem[] = []

  for (const i of items(next)) {
    if (i.urls.some((u) => seen.has(u)) || known.has(`${i.section}|${i.title.toLowerCase()}`)) continue
    changes.push({ section: i.section, kind: after(i.date, prev.generated_at) ? 'new' : 'found', title: i.title, date: i.date, evidence_urls: i.urls })
  }

  const before = new Map(prev.scores.map((s) => [s.dimension, s]))
  for (const s of next.scores) {
    const p = before.get(s.dimension)
    const from = p && !p.unknown ? Math.round(p.value) : null
    const to = s.unknown ? null : Math.round(s.value)
    if (from === to || (from !== null && to !== null && Math.abs(to - from) < 5)) continue
    changes.push({ section: 'scores', kind: 'moved', title: s.dimension, date: null, evidence_urls: s.evidence_urls, score: { dimension: s.dimension, from, to } })
  }

  const kinds = (r: CompanyResearch) => new Map(r.flags.map((f) => [f.kind, f]))
  const [was, now] = [kinds(prev), kinds(next)]
  for (const [k, f] of now) if (!was.has(k)) changes.push({ section: 'flags', kind: 'new', title: f.title, date: null, evidence_urls: f.evidence.map((e) => e.url) })
  for (const [k, f] of was) if (!now.has(k)) changes.push({ section: 'flags', kind: 'gone', title: f.title, date: null, evidence_urls: [] })

  return { since: prev.generated_at, items: changes.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)).slice(0, 40) }
}
