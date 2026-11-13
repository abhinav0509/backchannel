import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { Budget } from '../util/cost.js'

const callResearch = vi.hoisted(() => vi.fn())
const callStructured = vi.hoisted(() => vi.fn())
vi.mock('../llm/call.js', () => ({ callResearch, callStructured }))
const { researchStage } = await import('./shared.js')

describe('researchStage', () => {
  it('researches with search, then extracts with the retrieved URLs as the evidence allow-list', async () => {
    callResearch.mockResolvedValueOnce({
      notes: 'Raised. [1]', sources: [{ n: 1, url: 'https://a.example', title: 'A', page_age: null, quotes: ['q'] }],
      retrievedUrls: ['https://a.example', 'https://b.example'], searchCapped: true, at: '2026-11-01T00:00:00.000Z',
    })
    callStructured.mockResolvedValueOnce({ data: { ok: 1 }, dropped: ['d'] })
    const schema = z.object({ ok: z.number() })
    const budget = new Budget({ searchesPerRun: 40, tokensPerRun: 1e6 }, { spentBefore: 0, capUsd: 20 })

    const r = await researchStage({ stage: 'money', budget, system: 'sys', prompt: 'p', maxSearches: 8, task: 'do it', schema })

    expect(callResearch.mock.calls[0]?.[0]).toMatchObject({ stage: 'money', model: 'claude-sonnet-5-5', maxSearches: 8, system: 'sys', prompt: 'p' })
    const extract = callStructured.mock.calls[0]?.[0]
    expect(extract).toMatchObject({ stage: 'money', model: 'claude-haiku-5-5', schema, retrievedUrls: ['https://a.example', 'https://b.example'] })
    expect(extract.prompt).toContain('do it')
    expect(extract.prompt).toContain('retrieved_at is 2026-11-01T00:00:00.000Z')
    expect(r).toEqual({ data: { ok: 1 }, dropped: ['d'], searchCapped: true })
  })
})

it('passes constrained through to extraction', async () => {
  callResearch.mockResolvedValueOnce({ notes: '', sources: [], retrievedUrls: [], searchCapped: false, at: '2026-11-01T00:00:00.000Z' })
  callStructured.mockResolvedValueOnce({ data: {}, dropped: [] })
  const budget = new Budget({ searchesPerRun: 40, tokensPerRun: 1e6 }, { spentBefore: 0, capUsd: 20 })
  await researchStage({ stage: 'money', budget, system: 's', prompt: 'p', maxSearches: 1, task: 't', schema: z.object({}), constrained: false })
  expect(callStructured.mock.calls.at(-1)?.[0]).toMatchObject({ constrained: false })
})

it('extraction asks for gaps written to the candidate, not about the pipeline', async () => {
  const { extractionPrompt } = await import('./shared.js')
  const p = extractionPrompt({ task: 't', notes: 'n', sources: [], retrievedAt: '2026-11-01T00:00:00.000Z' })
  expect(p).toMatch(/never mention the notes, quotes or sources/i)
})
