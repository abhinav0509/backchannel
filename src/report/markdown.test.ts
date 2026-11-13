import { describe, expect, it } from 'vitest'
import type { CompanyResearch, EvidenceRef } from '../types/research'
import { toMarkdown } from './markdown'

const ev = (url: string, title = 'T'): EvidenceRef => ({
  url, title, publisher: 'Pub', published_at: '2024-02', retrieved_at: '2026-11-13T09:00:00Z', snippet: 'quote', trust_tier: 'secondary',
})
const c = <T>(value: T, urls: string[]) => ({ value, confidence: 'reported' as const, evidence: urls.map((u) => ev(u)), as_of: null })
const A = 'https://a.example/1'
const B = 'https://b.example/2'

// Placeholder data only, not facts about a real company.
const report = (): CompanyResearch => ({
  schema_version: 2, generated_at: '2026-11-13T09:00:00Z', partial: true,
  identity: { legal_name: c('Example Corp', [A]), display_name: 'Example', domain: 'example.com', hq: c('Nowhere', [A]), founded_year: null, is_public: c(false, [B]), resolution_confidence: 0.9 },
  money: { ownership_type: c('pe_backed', [B]), funding_events: [c({ date: '2021', round: 'Series C', amount: 50_000_000, currency: 'USD', investors: ['Fund A'] }, [B])], revenue_signal: null, profitability: null, exit_activity: [] },
  people: { headcount: null, headcount_trend: null, layoff_events: [c({ date: '2023-05', headcount: 100, percentage: 10, scope: 'company-wide', handling_notes: null }, [A])], leadership_changes: [], review_scores: [] },
  role: { title: 'Designer', level_claimed: 'Lead', location: 'Remote', work_policy: 'remote', employment_type: 'permanent', required_years: null, extracted_requirements: [] },
  flags: [
    { kind: 'layoff_history', polarity: 'risk', severity: 4, title: 'Cut 10% in 2023', detail: 'Detail.', basis: 'web', evidence: [ev(A)] },
    { kind: 'domain_fit', polarity: 'green', severity: 2, title: 'Fits interests', detail: 'Detail.', basis: 'profile', evidence: [] },
  ],
  scores: [
    { dimension: 'job_security', value: 35, rationale: 'Layoffs.', evidence_urls: [A], unknown: false },
    { dimension: 'comp_confidence', value: 0, rationale: 'No data.', evidence_urls: [], unknown: true },
  ],
  questions_to_ask: ['How did the 2023 cuts affect design?'],
  verdict: 'Main risk is layoffs.',
  gaps: ['Compensation could not be established.'],
  run: { mode: 'deep', searches_used: 12, input_tokens: 1000, output_tokens: 100, cost_usd: 1.234, duration_ms: 200_000, stage_status: { money: 'ok', people: 'partial' } },
})

describe('toMarkdown', () => {
  const md = toMarkdown(report())

  it('titles with company and role and states partial runs up front', () => {
    expect(md.split('\n')[0]).toBe('# Example: Designer')
    expect(md).toMatch(/partial/i)
    expect(md).toContain('$1.23')
  })

  it('numbers sources once in order of first use and cites them inline', () => {
    expect(md).toContain('Nowhere (reported) [1]')
    expect(md).toContain('1. [T](https://a.example/1)')
    expect(md).toContain('2. [T](https://b.example/2)')
    expect(md.match(/^\d+\. \[T\]/gm)).toHaveLength(2)
  })

  it('shows unknown scores as unknown, never as a number', () => {
    expect(md).toMatch(/Comp confidence \| Unknown/)
    expect(md).toMatch(/Job security \| 35/)
  })

  it('separates risk and green flags, and marks profile-based ones', () => {
    expect(md.indexOf('## Risk flags')).toBeLessThan(md.indexOf('Cut 10% in 2023'))
    expect(md).toMatch(/Fits interests.*from your profile/)
  })

  it('never shows an amount without its currency', () => {
    const r = report()
    r.money.funding_events = [c({ date: '2016', round: 'Series C', amount: 30, currency: null, investors: [] }, [B])]
    expect(toMarkdown(r)).not.toMatch(/Series C, 30/)
  })

  it('formats money as reported and lists gaps and questions', () => {
    expect(md).toContain('50,000,000 USD')
    expect(md).toContain('- Compensation could not be established.')
    expect(md).toContain('1. How did the 2023 cuts affect design?')
  })

  it('never repeats a marker for the same source', () => {
    const r = report()
    r.flags[0]!.evidence = [ev(A), ev(A), ev(B)]
    expect(toMarkdown(r)).toContain('severity 4) [1][2]')
  })

  it('says none instead of leaving a section empty', () => expect(md).toMatch(/## Leadership changes\n\nNone found\./))
})

describe('triageToMarkdown', () => {
  it('leads with the deep-dive recommendation and lists flags, gaps and cost', async () => {
    const { triageToMarkdown } = await import('./markdown')
    const r = report()
    const md = triageToMarkdown({
      schema_version: 2, generated_at: r.generated_at, partial: false, identity: r.identity, role: r.role,
      flags: r.flags, deep_dive: { recommended: true, reason: 'Layoffs in 2023.' }, gaps: ['Thin coverage.'],
      run: { ...r.run, mode: 'triage', cost_usd: 0.21 },
    })
    expect(md.split('\n')[0]).toBe('# Example: Designer (quick check)')
    expect(md).toContain('**Worth a deep dive.** Layoffs in 2023.')
    expect(md).toContain('Cut 10% in 2023')
    expect(md).toContain('- Thin coverage.')
    expect(md).toContain('$0.21')
  })
})

describe('roleTitle', () => {
  it('prefixes the level only when the title does not already say it', async () => {
    const { roleTitle } = await import('./markdown')
    expect(roleTitle('Lead', 'Lead Product Designer')).toBe('Lead Product Designer')
    expect(roleTitle('Senior', 'Product Designer')).toBe('Senior Product Designer')
    expect(roleTitle(null, 'Designer')).toBe('Designer')
    expect(roleTitle('lead', 'Design Lead')).toBe('Design Lead')
  })
})
