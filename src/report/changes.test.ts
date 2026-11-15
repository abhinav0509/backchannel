import { describe, expect, it } from 'vitest'
import { validReport } from '../test/fixtures'
import type { CompanyResearch } from '../types/research'
import { diffReports } from './changes'

// Placeholder data only, not facts about a real company.
const ev = (url: string) => ({ url, title: 't', publisher: null, published_at: null, retrieved_at: '2026-11-01T00:00:00.000Z', snippet: 's', trust_tier: 'secondary' as const })
const c = <T>(value: T, url: string) => ({ value, confidence: 'reported' as const, evidence: [ev(url)], as_of: null })
const score = (dimension: 'job_security' | 'culture', value: number, unknown = false) => ({ dimension, value, rationale: 'r', evidence_urls: [], unknown })
const market = (news: { date: string | null; headline: string; url: string }[]) => ({
  ai_stance: null, ai_summary: null, ai_initiatives: [], strategy: null, tailwinds: [], headwinds: [],
  recent_news: news.map((n) => c({ date: n.date, headline: n.headline }, n.url)),
})

function pair(): [CompanyResearch, CompanyResearch] {
  const before = { ...validReport(), generated_at: '2026-11-01T09:00:00.000Z' }
  before.market = market([{ date: '2026-10-20', headline: 'Old launch', url: 'https://a.example/old' }])
  before.scores = [score('job_security', 60), score('culture', 50)]
  before.flags = [{ kind: 'pe_ownership', polarity: 'risk', severity: 3, title: 'PE owned', detail: 'd', basis: 'web', evidence: [ev('https://a.example/pe')] }]
  const after = { ...validReport(), generated_at: '2026-11-15T09:00:00.000Z' }
  after.market = market([
    { date: '2026-10-20', headline: 'Old launch, reworded', url: 'https://a.example/old' },
    { date: '2026-11-10', headline: 'Cuts 8% of staff', url: 'https://a.example/cuts' },
    { date: '2025-03', headline: 'A 2025 deal the last run missed', url: 'https://a.example/deal' },
  ])
  after.scores = [score('job_security', 41), score('culture', 52)]
  after.flags = [{ kind: 'layoff_history', polarity: 'risk', severity: 4, title: 'Cut 8% in November', detail: 'd', basis: 'web', evidence: [ev('https://a.example/cuts')] }]
  return [before, after]
}

describe('diffReports', () => {
  const [before, after] = pair()
  const d = diffReports(before, after)

  it('is dated from the previous research', () => expect(d.since).toBe('2026-11-01T09:00:00.000Z'))

  it('calls something new only when its source is unseen and it is dated after the last research', () => {
    expect(d.items.filter((i) => i.kind === 'new').map((i) => i.title)).toEqual(expect.arrayContaining(['Cuts 8% of staff']))
    expect(d.items.find((i) => i.title === 'Cuts 8% of staff')).toMatchObject({ section: 'news', date: '2026-11-10', evidence_urls: ['https://a.example/cuts'] })
  })

  it('an older item the last research missed is "found", not new', () =>
    expect(d.items.find((i) => i.title === 'A 2025 deal the last run missed')).toMatchObject({ kind: 'found' }))

  it('the same article reworded is not a change', () => expect(d.items.some((i) => i.title.includes('Old launch'))).toBe(false))

  it('reports scores that moved by 5 or more, with from and to', () => {
    const moved = d.items.filter((i) => i.kind === 'moved')
    expect(moved.map((i) => i.score)).toEqual([{ dimension: 'job_security', from: 60, to: 41 }])
  })

  it('reports flags raised and flags no longer raised', () => {
    expect(d.items.find((i) => i.section === 'flags' && i.kind === 'new')).toMatchObject({ title: 'Cut 8% in November' })
    expect(d.items.find((i) => i.section === 'flags' && i.kind === 'gone')).toMatchObject({ title: 'PE owned' })
  })

  it('lists new first, then moved, then found, then gone', () => {
    const order = d.items.map((i) => i.kind)
    expect(order).toEqual([...order].sort((a, b) => ['new', 'moved', 'found', 'gone'].indexOf(a) - ['new', 'moved', 'found', 'gone'].indexOf(b)))
  })

  it('identical research has no changes', () => expect(diffReports(after, { ...after, generated_at: '2026-11-20T00:00:00.000Z' }).items).toEqual([]))
})
