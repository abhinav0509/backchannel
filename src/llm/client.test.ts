import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Budget } from '../util/cost.js'

const create = vi.hoisted(() => vi.fn())
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    beta = { messages: { create } }
    models = { retrieve: async () => ({ capabilities: { server_tools: { web_search: { supported: true } } } }) }
  },
}))
const { send } = await import('./client.js')

const usage = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: 2 } }
const reply = (text: string, stop = 'end_turn') => ({ model: 'claude-sonnet-5-5', stop_reason: stop, usage, content: [{ type: 'text', text }] })
const budget = () => new Budget({ searchesPerRun: 40, tokensPerRun: 1e6 }, { spentBefore: 0, capUsd: 20 })
const params = { model: 'claude-sonnet-5-5', max_tokens: 100, messages: [{ role: 'user' as const, content: 'hi' }] }

beforeEach(() => {
  create.mockReset()
  process.env.BACKCHANNEL_CACHE_DIR = mkdtempSync(join(tmpdir(), 'bc-llm-'))
  delete process.env.BACKCHANNEL_FRESH
})

describe('send', () => {
  it('charges the budget and returns content', async () => {
    create.mockResolvedValueOnce(reply('a'))
    const b = budget()
    const r = await send(params, { stage: 'money', budget: b })
    expect(r.content).toEqual([{ type: 'text', text: 'a' }])
    expect(r.cached).toBe(false)
    expect(b.total.searches).toBe(2)
  })

  it('serves an identical request from cache without calling the API or charging', async () => {
    create.mockResolvedValueOnce(reply('a'))
    const first = await send(params, { stage: 'money', budget: budget() })
    const b = budget()
    const second = await send(params, { stage: 'money', budget: b })
    expect(create).toHaveBeenCalledTimes(1)
    expect(second).toMatchObject({ content: first.content, cached: true, at: first.at })
    expect(b.total.usd).toBe(0)
  })

  it('misses the cache when anything in the request changes, or when fresh is set', async () => {
    create.mockResolvedValue(reply('a'))
    await send(params, { stage: 'money', budget: budget() })
    await send({ ...params, max_tokens: 101 }, { stage: 'money', budget: budget() })
    process.env.BACKCHANNEL_FRESH = '1'
    await send(params, { stage: 'money', budget: budget() })
    expect(create).toHaveBeenCalledTimes(3)
  })

  it('does not cache a refusal', async () => {
    create.mockResolvedValue({ ...reply(''), stop_reason: 'refusal', stop_details: { category: 'cyber' } })
    await expect(send(params, { stage: 'money', budget: budget() })).rejects.toThrow(/refused/)
    await expect(send(params, { stage: 'money', budget: budget() })).rejects.toThrow(/refused/)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('resumes a paused server-tool turn and stops resuming once the stage search cap is used', async () => {
    create.mockResolvedValueOnce(reply('part 1', 'pause_turn')).mockResolvedValueOnce(reply('part 2'))
    const r = await send(params, { stage: 'money', budget: budget(), maxSearches: 5 })
    expect(r.content.map((b) => (b as { text: string }).text)).toEqual(['part 1', 'part 2'])
    expect(create.mock.calls[1]?.[0].messages).toHaveLength(2)

    create.mockReset()
    create.mockResolvedValue(reply('x', 'pause_turn'))
    const capped = await send({ ...params, max_tokens: 7 }, { stage: 'money', budget: budget(), maxSearches: 2 })
    expect(capped.searchCapped).toBe(true)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('refuses to call once the budget is spent', async () => {
    const b = new Budget({ searchesPerRun: 40, tokensPerRun: 1e6 }, { spentBefore: 20, capUsd: 20 })
    await expect(send(params, { stage: 'money', budget: b })).rejects.toThrow(/monthly cap/)
    expect(create).not.toHaveBeenCalled()
  })
})
