import { z } from 'zod'
import { Business } from '../types/research'
import type { Budget } from '../util/cost'
import { companyLine, researchRules, researchStage, today } from './shared'

const MAX_SEARCHES = 6

export const BusinessOut = Business.extend({ gaps: z.array(z.string()) })
export type BusinessOut = z.infer<typeof BusinessOut>

export const businessSystem = `You research what a company does and who runs it, for a candidate deciding whether to interview there. Today is ${today()}. You separate what the company says about itself from what others report.`

export const businessPrompt = (c: { display_name: string; domain: string }) => `You are researching ${companyLine(c)}

TASK
Establish:
- What the company does, in plain words: its main products or services, who its customers are, and how it makes money.
- Its main products, each with a one-line description.
- Its closest competitors, as named by independent sources or analysts.
- Its founders: name, founding role, background, and whether they are still involved.
- Its current leadership: chief executive and other executives, and the heads of product, design and engineering where sources name them, with when they started.

${researchRules(MAX_SEARCHES)}`

export const businessTask = `summary, customers, business_model: a sentence or two each, or null. products: one claim per product, name and one-line description, at most 8 (the main ones). competitors: one claim per named competitor, at most 6; the value is the company name alone, with nothing else in it. founders: one claim per person. leaders: one claim per person, at most 10, executives first. background and since only where sourced, else null; still_involved null unless a source says. Give each claim one evidence entry: the source that states it most directly.`

// constrained: false, like money and people: claim-heavy schemas exceed the structured-output grammar limit.
export async function business(c: { display_name: string; domain: string }, budget: Budget) {
  return researchStage({ stage: 'business', budget, system: businessSystem, prompt: businessPrompt(c), maxSearches: MAX_SEARCHES, task: businessTask, schema: BusinessOut, constrained: false })
}
