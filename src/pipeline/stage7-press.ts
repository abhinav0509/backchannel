import { z } from 'zod'
import { Press } from '../types/research'
import type { Budget } from '../util/cost'
import { companyLine, researchRules, researchStage, today } from './shared'

const MAX_SEARCHES = 5

export const PressOut = Press.extend({ gaps: z.array(z.string()) })
export type PressOut = z.infer<typeof PressOut>

export const pressSystem = `You gather what the media says about a company and what the company says about itself, for a candidate deciding whether to interview there. Today is ${today()}. You keep the two apart, and you report how a piece frames the company without adding your own view.`

export const pressPrompt = (c: { display_name: string; domain: string }) => `You are researching ${companyLine(c)}

TASK
Find:
- Media coverage from the last 12 months: established news outlets, trade press and analysts writing about the company itself (not passing mentions). Prefer pieces that say where it is heading: strategy, products, deals, trouble.
- What the company says about itself: its newsroom or press releases, its product or company blog, and especially its design blog and engineering blog. Note what the design and engineering teams write about.

Use search results and their snippets. Do not open paywalled articles or social media pages; a headline and snippet are enough.

${researchRules(MAX_SEARCHES)}`

export const pressTask = `coverage: media pieces only, at most 8, the most substantive first. own: the company's own posts, at most 6; a press release goes in own even when an aggregator republished it. For each: title as published; publisher; date; kind (news, analysis, newsroom, company_blog, design_blog or engineering_blog); summary, one sentence from the snippet; angle, how the piece frames the company (positive, neutral or critical) judged from the snippet alone, and null for the company's own posts. Give each claim one evidence entry: the article itself.`

// Constrained: the schema fits the structured-output grammar (probed 2026-11-14), so the JSON is always well formed.
export async function press(c: { display_name: string; domain: string }, budget: Budget) {
  return researchStage({ stage: 'press', budget, system: pressSystem, prompt: pressPrompt(c), maxSearches: MAX_SEARCHES, task: pressTask, schema: PressOut })
}
