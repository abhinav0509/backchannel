import { z } from 'zod'
import { CompanyResearch } from '../types/research.js'
import type { Budget } from '../util/cost.js'
import { companyLine, researchRules, researchStage, today } from './shared.js'

const MAX_SEARCHES = 10

export const PeopleOut = CompanyResearch.shape.people.extend({ gaps: z.array(z.string()) })
export type PeopleOut = z.infer<typeof PeopleOut>

export const peopleSystem = `You research a company's workforce and leadership for a candidate deciding whether to interview there. Today is ${today()}. Employee review data is self-selected and skews negative; always give sample size and direction where sources show them.`

export const peoplePrompt = (c: { display_name: string; domain: string }) => `You are researching ${companyLine(c)}

TASK
Establish:
- Current headcount and how it has moved year by year, with the source of each figure. Headcount figures often conflict; report the conflict rather than picking one.
- Layoffs in the last four years: date, number of people, percentage, which teams, and how it was handled if reported.
- Leadership changes in the last 24 months: C-suite and heads of product, design or engineering, arriving or leaving.
- Employee review scores by source (for example Glassdoor, AmbitionBox, Blind, Indeed), with score, scale, number of reviews and whether the trend is rising, flat or falling.
- Any recent change to return-to-office or work policy.

${researchRules(MAX_SEARCHES)}`

export const peopleTask = `headcount: the most recent sourced figure or null; headcount_trend: year and count pairs only where sourced. layoff_events, leadership_changes, review_scores: one claim per item. A review score's trend is unknown unless a source shows direction.`

export async function people(c: { display_name: string; domain: string }, budget: Budget) {
  return researchStage({ stage: 'people', budget, system: peopleSystem, prompt: peoplePrompt(c), maxSearches: MAX_SEARCHES, task: peopleTask, schema: PeopleOut })
}
