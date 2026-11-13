import type Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'
import { BudgetExceeded, type Budget } from '../util/cost.js'
import type { StageName } from '../types/research.js'
import { assertSearchSupported, send } from './client.js'
import { validateSourced } from './evidence.js'
import { webSearchTool } from './search.js'

const MAX_RETRIES = 2
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export class ValidationFailed extends Error {}

const textOf = (content: Anthropic.Beta.BetaContentBlock[]) =>
  content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')

/**
 * One typed call: prompt + zod schema -> validated object. On a validation failure the errors are
 * fed back and the call retried, at most MAX_RETRIES times. With `retrievedUrls`, citations the
 * search never returned are removed and claims left unsourced are dropped (see validateSourced).
 */
export async function callStructured<S extends z.ZodType>(o: {
  stage: StageName
  budget: Budget
  model: string
  system: string
  prompt: string
  schema: S
  effort?: Effort
  retrievedUrls?: readonly string[]
}): Promise<{ data: z.output<S>; dropped: string[] }> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: o.prompt }]
  let issues = ''
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { content } = await send(
      {
        model: o.model,
        max_tokens: 16000,
        system: o.system,
        messages,
        output_config: { format: zodOutputFormat(o.schema), ...(o.effort && { effort: o.effort }) },
      },
      { stage: o.stage, budget: o.budget },
    )
    const result = validateSourced(textOf(content), o.schema, o.retrievedUrls)
    if (result.ok) return { data: result.data, dropped: result.dropped }
    issues = result.issues
    messages.push(
      { role: 'assistant', content },
      {
        role: 'user',
        content: `That output failed validation:\n${issues}\n\nReturn corrected JSON only. Never invent a source: leave out any claim you cannot cite and say so in gaps.`,
      },
    )
  }
  throw new ValidationFailed(`${o.stage}: still invalid after ${MAX_RETRIES} retries\n${issues}`)
}

export interface Source {
  n: number
  url: string
  title: string
  page_age: string | null
  quotes: string[]
}

/**
 * A research call with web search. Returns the model's notes with [n] citation markers, the
 * numbered sources it cited, and every URL the search returned (the allow-list for evidence).
 */
export async function callResearch(o: {
  stage: StageName
  budget: Budget
  model: string
  system: string
  prompt: string
  maxSearches: number
  effort?: Effort
}): Promise<{ notes: string; sources: Source[]; retrievedUrls: string[]; searchCapped: boolean }> {
  const maxUses = Math.min(o.maxSearches, o.budget.remainingSearches)
  if (maxUses === 0) throw new BudgetExceeded('run search cap reached')
  await assertSearchSupported(o.model)

  const { content, searchCapped } = await send(
    {
      model: o.model,
      max_tokens: 16000,
      system: o.system,
      messages: [{ role: 'user', content: o.prompt }],
      tools: [webSearchTool(maxUses)],
      ...(o.effort && { output_config: { effort: o.effort } }),
    },
    { stage: o.stage, budget: o.budget, maxSearches: maxUses },
  )

  const pageAge = new Map<string, string | null>()
  for (const b of content)
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content))
      for (const r of b.content) pageAge.set(r.url, r.page_age)

  const sources = new Map<string, Source>()
  let notes = ''
  for (const b of content) {
    if (b.type !== 'text') continue
    notes += b.text
    for (const c of b.citations ?? []) {
      if (c.type !== 'web_search_result_location') continue
      const s = sources.get(c.url) ?? { n: sources.size + 1, url: c.url, title: c.title ?? c.url, page_age: pageAge.get(c.url) ?? null, quotes: [] }
      sources.set(c.url, s)
      if (!s.quotes.includes(c.cited_text)) s.quotes.push(c.cited_text)
      notes += ` [${s.n}]`
    }
  }
  return { notes, sources: [...sources.values()], retrievedUrls: [...pageAge.keys()], searchCapped }
}
