import Anthropic from '@anthropic-ai/sdk'
import type { Budget } from '../util/cost.js'
import { log } from '../util/log.js'
import type { StageName } from '../types/research.js'

type Params = Anthropic.Beta.MessageCreateParamsNonStreaming
type Block = Anthropic.Beta.BetaContentBlock

let client: Anthropic | undefined
const api = () => (client ??= new Anthropic())

export class RefusalError extends Error {}

const searchSupport = new Map<string, Promise<boolean>>()

/** Asks the Models API, once per model per process, whether the model takes the web search tool. */
export async function assertSearchSupported(model: string): Promise<void> {
  if (!searchSupport.has(model))
    searchSupport.set(model, api().models.retrieve(model).then((m) => m.capabilities?.server_tools.web_search.supported ?? false))
  if (!(await searchSupport.get(model))) throw new Error(`${model} does not support the web search tool`)
}

/**
 * The only place the SDK is called. Enforces the budget before each request, charges usage
 * after it, resumes server-tool turns that pause, and returns every content block produced.
 * Sonnet and Opus calls opt into server-side refusal fallbacks; Haiku has none.
 */
export async function send(
  params: Omit<Params, 'betas' | 'fallbacks'>,
  ctx: { stage: StageName; budget: Budget; maxSearches?: number },
): Promise<{ content: Block[]; searchCapped: boolean }> {
  const messages = [...params.messages]
  const content: Block[] = []
  let searches = 0

  for (;;) {
    ctx.budget.assertCanSpend()
    const fallback = params.model.startsWith('claude-haiku')
      ? {}
      : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
    const started = Date.now()
    const res = await api().beta.messages.create({ ...params, ...fallback, messages })

    const u = res.usage
    const usage = {
      input: u.input_tokens,
      output: u.output_tokens,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      searches: u.server_tool_use?.web_search_requests ?? 0,
    }
    const usd = ctx.budget.charge(ctx.stage, res.model, usage)
    searches += usage.searches
    content.push(...res.content)
    log('llm_call', { stage: ctx.stage, model: res.model, stop: res.stop_reason, ms: Date.now() - started, ...usage, usd })

    if (res.stop_reason === 'refusal') throw new RefusalError(`${ctx.stage}: model refused (${res.stop_details?.category ?? 'no category'})`)
    if (res.stop_reason !== 'pause_turn') return { content, searchCapped: false }
    // A paused server-tool turn resumes by resending it unchanged. Stop instead once the stage's searches are spent.
    if (ctx.maxSearches !== undefined && (searches >= ctx.maxSearches || ctx.budget.remainingSearches === 0))
      return { content, searchCapped: true }
    messages.push({ role: 'assistant', content: res.content })
  }
}
