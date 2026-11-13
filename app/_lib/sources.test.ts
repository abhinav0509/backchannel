import { describe, expect, it } from 'vitest'
import { validReport, ev, claim } from '../../src/test/fixtures'
import { sourceIndex } from './sources'

describe('sourceIndex', () => {
  it('numbers each source once in report order and keeps its first evidence record', () => {
    const r = validReport()
    r.identity.hq = { ...claim('X'), evidence: [ev('https://b.example/1', { title: 'B' })] }
    r.identity.legal_name = { ...claim('Y'), evidence: [ev('https://a.example/1', { title: 'A' })] }
    const idx = sourceIndex(r)
    expect(idx.get('https://a.example/1')).toMatchObject({ n: 1, ref: { title: 'A' } })
    expect(idx.get('https://b.example/1')?.n).toBe(2)
  })

  it('still numbers a URL cited only by a score', () => {
    const r = validReport()
    r.scores = [{ dimension: 'culture', value: 1, rationale: 'r', evidence_urls: ['https://z.example/'], unknown: false }]
    expect(sourceIndex(r).get('https://z.example/')).toMatchObject({ ref: null })
  })
})
