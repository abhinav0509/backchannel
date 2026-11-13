import { z } from 'zod'
import { CompanyResearch } from '../types/research'
import type { Budget } from '../util/cost'
import { companyLine, researchRules, researchStage, today } from './shared'

const MAX_SEARCHES = 8

export const MoneyOut = CompanyResearch.shape.money.extend({ gaps: z.array(z.string()) })
export type MoneyOut = z.infer<typeof MoneyOut>

export const moneySystem = `You research a company's ownership and finances for a candidate deciding whether to interview there. Today is ${today()}. You are precise about who owns the company and what is known versus rumoured.`

export const moneyPrompt = (c: { display_name: string; domain: string }) => `You are researching ${companyLine(c)}

TASK
Establish:
- Ownership type: public, private-equity backed, venture backed, bootstrapped, or a subsidiary of another company. Name the owners or backers.
- Funding and ownership events: each round, majority investment or acquisition, with date, amount and currency exactly as reported, and investors.
- Revenue signals: reported revenue or ARR, with the year it describes.
- Profitability signals: profitable, cash-flow positive, or loss-making, as reported.
- Exit activity in the last three years: sale processes, IPO plans or rumours, acquisitions the company made.

${researchRules(MAX_SEARCHES)}`

export const moneyTask = `ownership_type: one of public, pe_backed, vc_backed, bootstrapped, subsidiary, unknown; null if no source states it. funding_events: one claim per event; amount in full units as reported ("$30 million" is 30000000), with its ISO currency, never converted; if a source gives no currency, amount is null and the gap says so. revenue_signal, profitability: a short sentence each, or null. exit_activity: one claim per sale process, IPO signal or acquisition.`

// constrained: false because this schema exceeds the API's structured-output grammar limit (400, probed 2026-11-13).
export async function money(c: { display_name: string; domain: string }, budget: Budget) {
  return researchStage({ stage: 'money', budget, system: moneySystem, prompt: moneyPrompt(c), maxSearches: MAX_SEARCHES, task: moneyTask, schema: MoneyOut, constrained: false })
}
