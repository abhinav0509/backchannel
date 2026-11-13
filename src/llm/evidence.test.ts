import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { claim, Flag } from '../types/research.js'
import { stripUnretrieved, validateSourced } from './evidence.js'

const ev = (url: string) => ({
  url, title: 't', publisher: null, published_at: null,
  retrieved_at: '2026-11-13T09:00:00Z', snippet: 's', trust_tier: 'secondary',
})
const c = (value: unknown, urls: string[]) => ({ value, confidence: 'reported', evidence: urls.map(ev), as_of: null })

const Out = z.object({
  hq: claim(z.string()),
  revenue: claim(z.string()).nullable(),
  layoffs: z.array(claim(z.string())),
  flags: z.array(Flag),
  gaps: z.array(z.string()),
})
const GOOD = 'https://news.example/a'
const FAKE = 'https://made.up/x'

describe('stripUnretrieved', () => {
  it('removes citations the search never returned, matching across fragments and trailing slashes', () => {
    const v = { hq: c('x', [GOOD + '/#top', FAKE]), scores: [{ evidence_urls: [GOOD, FAKE] }] }
    expect(stripUnretrieved(v, [GOOD])).toEqual([FAKE])
    expect(v.hq.evidence.map((e) => e.url)).toEqual([GOOD + '/#top'])
    expect(v.scores[0]?.evidence_urls).toEqual([GOOD])
  })
})

describe('validateSourced', () => {
  const base = () => ({ hq: c('x', [GOOD]), revenue: null, layoffs: [], flags: [], gaps: [] })

  it('passes clean output through', () => {
    const r = validateSourced(JSON.stringify(base()), Out, [GOOD])
    expect(r).toMatchObject({ ok: true, dropped: [] })
  })

  it('drops array claims and nullable claims whose only source was invented, and says so', () => {
    const v = { ...base(), revenue: c('$1B', [FAKE]), layoffs: [c('2023', [GOOD]), c('2024', [FAKE]), c('2025', [FAKE])] }
    const r = validateSourced(JSON.stringify(v), Out, [GOOD])
    if (!r.ok) throw new Error(r.issues)
    expect(r.data.revenue).toBeNull()
    expect(r.data.layoffs.map((l) => l.value)).toEqual(['2023'])
    expect(r.dropped.filter((d) => d.startsWith('dropped'))).toHaveLength(3)
    expect(r.dropped).toContain(`removed a citation the search never returned: ${FAKE}`)
  })

  it('drops a web flag with no evidence but keeps a profile flag', () => {
    const flag = { kind: 'domain_fit', polarity: 'green', severity: 2, title: 't', detail: 'd', evidence: [] }
    const v = { ...base(), flags: [{ ...flag, basis: 'web' }, { ...flag, basis: 'profile' }] }
    const r = validateSourced(JSON.stringify(v), Out, [GOOD])
    if (!r.ok) throw new Error(r.issues)
    expect(r.data.flags.map((f) => f.basis)).toEqual(['profile'])
  })

  it('fails, rather than inventing anything, when a required claim loses its source', () => {
    const r = validateSourced(JSON.stringify({ ...base(), hq: c('x', [FAKE]) }), Out, [GOOD])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues).toMatch(/hq/)
  })

  it('reports invalid JSON', () => expect(validateSourced('{nope', Out)).toMatchObject({ ok: false }))
})

describe('collectEvidenceUrls', () => {
  it('lists every evidence URL once, in document order', async () => {
    const { collectEvidenceUrls } = await import('./evidence.js')
    const v = { a: c('x', [GOOD]), b: [c('y', ['https://b.example/1', GOOD])], s: [{ evidence_urls: ['https://c.example/'] }] }
    expect(collectEvidenceUrls(v)).toEqual([GOOD, 'https://b.example/1', 'https://c.example/'])
  })
})

describe('validateSourced JSON extraction', () => {
  it('accepts JSON wrapped in a code fence or surrounding prose', () => {
    const S = z.object({ a: z.number() })
    expect(validateSourced('```json\n{"a":1}\n```', S)).toMatchObject({ ok: true, data: { a: 1 } })
    expect(validateSourced('Here it is:\n{"a":2}\nDone.', S)).toMatchObject({ ok: true, data: { a: 2 } })
  })
})
