import { z } from 'zod'
import { Flag } from '../types/research.js'
import type { Budget } from '../util/cost.js'
import { companyLine, researchRules, researchStage, today } from './shared.js'

const MAX_SEARCHES = 4

export const TriageOut = z.object({
  flags: z.array(Flag),
  deep_dive: z.object({ recommended: z.boolean(), reason: z.string() }),
  gaps: z.array(z.string()),
})
export type TriageOut = z.infer<typeof TriageOut>

export const triageSystem = `You do a fast first check on a company for a candidate who gets many recruiter emails and must decide which deserve a full investigation. Today is ${today()}.`

export const triagePrompt = (c: { display_name: string; domain: string }) => `You are researching ${companyLine(c)}

TASK
In a few searches, check for the signals that most change whether this is worth pursuing:
- Who owns it (public, private equity, venture backed) and any sale or recapitalisation in progress.
- Layoffs in the last two years.
- Major news in the last twelve months: leadership departures, funding, acquisitions, scandals.
End with one line: whether a full investigation is worth it, and why.

${researchRules(MAX_SEARCHES)}`

export const triageTask = `flags: only kinds the notes support, using the fixed taxonomy; basis is web. deep_dive: the recommendation and its reason in one or two sentences addressed to the candidate, naming the specific findings (not "the notes"); recommend a deep dive when a serious risk appears or the company looks like a strong option.`

export async function triage(c: { display_name: string; domain: string }, budget: Budget) {
  return researchStage({ stage: 'triage', budget, system: triageSystem, prompt: triagePrompt(c), maxSearches: MAX_SEARCHES, task: triageTask, schema: TriageOut })
}
