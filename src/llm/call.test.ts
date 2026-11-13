import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { Budget } from '../util/cost.js'

const send = vi.fn()
vi.mock('./client.js', () => ({ send: (...a: unknown[]) => send(...a), assertSearchSupported: async () => {} }))
const { callResearch, callStructured, ValidationFailed } = await import('./call.js')

const text = (t: string) => ({ content: [{ type: 'text', text: t }], searchCapped: false })
const budget = () => new Budget({ searchesPerRun: 10, tokensPerRun: 1e6 }, { spentBefore: 0, capUsd: 20 })
const Schema = z.object({ year: z.int().min(1900) })
const opts = () => ({ stage: 'parse' as const, budget: budget(), model: 'claude-haiku-5-5', system: 's', prompt: 'p', schema: Schema })

beforeEach(() => send.mockReset())

describe('callStructured', () => {
  it('returns on the first valid answer', async () => {
    send.mockResolvedValueOnce(text('{"year":2020}'))
    await expect(callStructured(opts())).resolves.toEqual({ data: { year: 2020 }, dropped: [] })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('feeds the validation error back and retries', async () => {
    send.mockResolvedValueOnce(text('{"year":12}')).mockResolvedValueOnce(text('{"year":2012}'))
    await expect(callStructured(opts())).resolves.toMatchObject({ data: { year: 2012 } })
    const retryMessages = send.mock.calls[1]?.[0].messages
    expect(retryMessages).toHaveLength(3)
    expect(retryMessages[2].content).toMatch(/year/)
  })

  it('gives up after two retries instead of retrying forever', async () => {
    send.mockResolvedValue(text('{"year":12}'))
    await expect(callStructured(opts())).rejects.toBeInstanceOf(ValidationFailed)
    expect(send).toHaveBeenCalledTimes(3)
  })
})

describe('callResearch', () => {
  it('numbers cited sources and collects every returned URL', async () => {
    send.mockResolvedValueOnce({
      searchCapped: false,
      content: [
        { type: 'web_search_tool_result', content: [
          { type: 'web_search_result', url: 'https://a.example/1', title: 'A', page_age: '2024-01-02', encrypted_content: '' },
          { type: 'web_search_result', url: 'https://b.example/2', title: 'B', page_age: null, encrypted_content: '' },
        ] },
        { type: 'text', text: 'Raised a round.', citations: [
          { type: 'web_search_result_location', url: 'https://a.example/1', title: 'A', cited_text: 'raised $10M', encrypted_index: '' },
        ] },
      ],
    })
    const r = await callResearch({ ...opts(), stage: 'money', model: 'claude-sonnet-5-5', maxSearches: 5 })
    expect(r.notes).toBe('Raised a round. [1]')
    expect(r.sources).toEqual([{ n: 1, url: 'https://a.example/1', title: 'A', page_age: '2024-01-02', quotes: ['raised $10M'] }])
    expect(r.retrievedUrls).toEqual(['https://a.example/1', 'https://b.example/2'])
    expect(send.mock.calls[0]?.[0].tools[0]).toMatchObject({ name: 'web_search', max_uses: 5 })
  })

  it('caps max_uses at what the run has left', async () => {
    send.mockResolvedValueOnce(text('nothing'))
    const b = budget()
    b.charge('resolve', 'claude-sonnet-5-5', { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 8 })
    await callResearch({ ...opts(), budget: b, stage: 'money', model: 'claude-sonnet-5-5', maxSearches: 5 })
    expect(send.mock.calls[0]?.[0].tools[0].max_uses).toBe(2)
  })
})

describe('callStructured without constrained decoding', () => {
  it('puts the JSON Schema in the prompt instead of output_config, for schemas too large for the grammar', async () => {
    send.mockResolvedValueOnce(text('```json\n{"year":2020}\n```'))
    await expect(callStructured({ ...opts(), constrained: false })).resolves.toMatchObject({ data: { year: 2020 } })
    const params = send.mock.calls[0]?.[0]
    expect(params.output_config?.format).toBeUndefined()
    expect(params.messages[0].content).toContain('"year"')
    expect(params.messages[0].content).toMatch(/only JSON/i)
  })
})
