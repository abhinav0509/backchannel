import { z } from 'zod'
import { AiStance, Market } from '../types/research'
import type { Budget } from '../util/cost'
import { companyLine, researchRules, researchStage, today } from './shared'

const MAX_SEARCHES = 6

export const MarketOut = Market.extend({ gaps: z.array(z.string()) })
export type MarketOut = z.infer<typeof MarketOut>

export const marketSystem = `You research where a company stands on AI and where it is heading, for a candidate deciding whether to interview there. Today is ${today()}. Announcements are not results: say which is which.`

export const marketPrompt = (c: { display_name: string; domain: string }) => `You are researching ${companyLine(c)}

TASK
Establish:
- How central AI is to the company: AI is the product, AI is core to the product, the company is adopting AI in its products or operations, AI is peripheral, or no AI work is evident.
- Its AI products, features, partnerships and investments, with dates.
- Its stated strategy and direction for the next few years.
- Notable news from the last 12 months: launches, deals, restructurings, leadership moves, legal or regulatory events.
- Tailwinds and headwinds for its market, as independent sources describe them.

${researchRules(MAX_SEARCHES)}`

export const marketTask = `ai_stance: one of ${AiStance.options.join(', ')}, or null if sources do not show it. ai_summary, strategy: a sentence or two each, or null. ai_initiatives: one claim per product, feature, partnership or investment. recent_news: one claim per event, with its date and a plain headline. tailwinds, headwinds: one claim each, a short sentence.`

// constrained: false, like money and people: claim-heavy schemas exceed the structured-output grammar limit.
export async function market(c: { display_name: string; domain: string }, budget: Budget) {
  return researchStage({ stage: 'market', budget, system: marketSystem, prompt: marketPrompt(c), maxSearches: MAX_SEARCHES, task: marketTask, schema: MarketOut, constrained: false })
}
