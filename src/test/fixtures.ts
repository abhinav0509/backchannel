import type { CompanyResearch, EvidenceRef, TriageResult } from '../types/research'

// Placeholder data for tests and UI previews only. Not facts about any real company.
export const ev = (url = 'https://news.example/a', o: Partial<EvidenceRef> = {}): EvidenceRef => ({
  url, title: 'Example News report', publisher: 'Example News', published_at: '2024-03', retrieved_at: '2026-11-13T09:00:00.000Z',
  snippet: 'A short quote from the page that states the fact.', trust_tier: 'secondary', ...o,
})
export const claim = <T>(value: T, urls = ['https://news.example/a'], confidence: 'confirmed' | 'reported' | 'unverified' = 'reported') => ({
  value, confidence, evidence: urls.map((u) => ev(u)), as_of: null,
})

export function validReport(o: { name?: string; domain?: string } = {}): CompanyResearch {
  const name = o.name ?? 'Example'
  return {
    schema_version: 2, generated_at: '2026-11-13T09:00:00.000Z', partial: false,
    identity: { legal_name: claim(`${name} Inc.`), display_name: name, domain: o.domain ?? 'example.com', hq: claim('Nowhere'), founded_year: null, is_public: claim(false), resolution_confidence: 0.9 },
    money: { ownership_type: claim('pe_backed'), funding_events: [], revenue_signal: null, profitability: null, exit_activity: [] },
    people: { headcount: null, headcount_trend: null, layoff_events: [], leadership_changes: [], review_scores: [] },
    role: { title: 'Product Designer', level_claimed: 'Lead', location: 'Remote', work_policy: 'remote', employment_type: 'permanent', required_years: null, extracted_requirements: [] },
    business: null, market: null, contacts: null,
    flags: [], scores: [], questions_to_ask: [], questions: [], verdict: 'Placeholder verdict.', outlook: null, gaps: [],
    run: { mode: 'deep', searches_used: 10, input_tokens: 100, output_tokens: 10, cost_usd: 1, duration_ms: 1000, stage_status: { parse: 'ok' } },
  }
}

export function validTriage(o: { name?: string; domain?: string } = {}): TriageResult {
  const r = validReport(o)
  return {
    schema_version: 2, generated_at: r.generated_at, partial: false, identity: r.identity, role: r.role, flags: [],
    deep_dive: { recommended: true, reason: 'Placeholder reason.' }, gaps: [], run: { ...r.run, mode: 'triage' },
  }
}
