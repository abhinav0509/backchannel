import { describe, expect, it } from 'vitest'
import { claim, CompanyResearch, Flag, FundingEvent, LayoffEvent } from './research.js'
import { z } from 'zod'

const ev = (url = 'https://example.com/news/1') => ({
  url,
  title: 'Example',
  publisher: 'Example News',
  published_at: '2024-03',
  retrieved_at: '2026-11-13T09:00:00Z',
  snippet: 'quoted text',
  trust_tier: 'secondary' as const,
})
const c = <T>(value: T, evidence = [ev()]) => ({ value, confidence: 'reported' as const, evidence, as_of: null })

// Placeholder values only. Not facts about any real company.
const research = () => ({
  schema_version: 2,
  generated_at: '2026-11-13T09:00:00Z',
  partial: false,
  identity: {
    legal_name: c('Example Corp'), display_name: 'Example', domain: 'example.com',
    hq: c('Nowhere'), founded_year: null, is_public: c(false), resolution_confidence: 0.9,
  },
  money: { ownership_type: null, funding_events: [], revenue_signal: null, profitability: null, exit_activity: [] },
  people: { headcount: null, headcount_trend: null, layoff_events: [], leadership_changes: [], review_scores: [] },
  role: {
    title: 'Designer', level_claimed: null, location: null, work_policy: 'unknown',
    employment_type: 'unknown', required_years: null, extracted_requirements: [],
  },
  flags: [],
  scores: [],
  questions_to_ask: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
  verdict: 'v',
  gaps: ['ownership could not be established'],
  run: { mode: 'deep', searches_used: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0, duration_ms: 0, stage_status: { parse: 'ok' } },
})

describe('claims', () => {
  const StringClaim = claim(z.string())
  it('accepts a sourced claim', () => expect(StringClaim.safeParse(c('x')).success).toBe(true))
  it('rejects a claim with no evidence', () => expect(StringClaim.safeParse(c('x', [])).success).toBe(false))
  it('rejects a snippet over 300 chars', () =>
    expect(StringClaim.safeParse(c('x', [{ ...ev(), snippet: 'a'.repeat(301) }])).success).toBe(false))
  it('accepts year-only dates and rejects free text', () => {
    expect(StringClaim.safeParse({ ...c('x'), as_of: '2023' }).success).toBe(true)
    expect(StringClaim.safeParse({ ...c('x'), as_of: 'March 2023' }).success).toBe(false)
  })
})

describe('CompanyResearch', () => {
  it('accepts a minimal valid report', () => expect(CompanyResearch.safeParse(research()).success).toBe(true))
  it('rejects a report whose identity claim lost its evidence', () => {
    const r = research()
    r.identity.hq.evidence = []
    expect(CompanyResearch.safeParse(r).success).toBe(false)
  })
  it('rejects a domain with a scheme', () => {
    const r = research()
    r.identity.domain = 'https://example.com'
    expect(CompanyResearch.safeParse(r).success).toBe(false)
  })
  it('rejects fewer than six questions', () => {
    const r = research()
    r.questions_to_ask = ['q1']
    expect(CompanyResearch.safeParse(r).success).toBe(false)
  })
})

describe('flags', () => {
  const flag = { kind: 'domain_fit', polarity: 'green', severity: 3, title: 't', detail: 'd' }
  it('lets a profile-based flag have no evidence', () =>
    expect(Flag.safeParse({ ...flag, basis: 'profile', evidence: [] }).success).toBe(true))
  it('rejects a web-based flag with no evidence', () =>
    expect(Flag.safeParse({ ...flag, basis: 'web', evidence: [] }).success).toBe(false))
})

describe('numbers', () => {
  it('rejects a layoff percentage given as a fraction over 100', () =>
    expect(LayoffEvent.safeParse({ date: null, headcount: null, percentage: 150, scope: null, handling_notes: null }).success).toBe(false))
  it('rejects a currency that is not a 3-letter code', () =>
    expect(FundingEvent.safeParse({ date: null, round: null, amount: 1, currency: 'dollars', investors: [] }).success).toBe(false))
})
