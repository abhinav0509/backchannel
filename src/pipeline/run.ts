import type { CompanyResearch } from '../types/research.js'
import { runBudget, type Budget } from '../util/cost.js'
import { parse, type ParseOut } from './stage0-parse.js'
import { gate, resolve, type Candidate, type ResolveOut } from './stage1-resolve.js'

export type RunOutcome =
  | { kind: 'report'; report: CompanyResearch; budget: Budget }
  | { kind: 'needs_choice'; reason: string; candidates: Candidate[]; gaps: string[]; budget: Budget }
  // Temporary until stages 3, 4 and 8 exist: resolution succeeded and the run stops there.
  | { kind: 'resolved'; parsed: ParseOut; resolved: ResolveOut; dropped: string[]; budget: Budget }

export async function runResearch(input: { text: string; companyDomain?: string }): Promise<RunOutcome> {
  const budget = runBudget('deep')
  const parsed = await parse(input.text, budget)
  const { out, dropped } = await resolve(parsed, budget, input.companyDomain)

  const g = gate(out, input.companyDomain)
  if (g === 'mismatch')
    throw new Error(
      out.identity
        ? `you gave ${input.companyDomain}, but research resolved ${out.identity.domain}; check the domain`
        : `could not source the identity of ${input.companyDomain} (legal name, HQ, public status):\n  ${[...out.gaps, ...dropped].join('\n  ')}`,
    )
  if (g === 'ask') {
    const reason = out.identity
      ? `resolution confidence ${out.identity.resolution_confidence} is below 0.8`
      : 'the top candidate could not be sourced well enough to confirm its identity'
    return { kind: 'needs_choice', reason, candidates: out.candidates, gaps: [...out.gaps, ...dropped], budget }
  }
  return { kind: 'resolved', parsed, resolved: out, dropped, budget }
}
