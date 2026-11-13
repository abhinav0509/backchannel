import { z } from 'zod'
import { Domain, Identity } from '../types/research.js'
import type { Budget } from '../util/cost.js'
import { researchRules, researchStage, today } from './shared.js'
import type { ParseOut } from './stage0-parse.js'

export const RESOLVE_THRESHOLD = 0.8
const MAX_SEARCHES = 4

export const Candidate = z.object({
  name: z.string(),
  domain: Domain,
  confidence: z.number().min(0).max(1), // that this is the company the text means
  reason: z.string(),
})
export type Candidate = z.infer<typeof Candidate>

export const ResolveOut = z.object({
  candidates: z.array(Candidate),
  identity: Identity.nullable(), // the most likely company; null only when there is no candidate at all
  gaps: z.array(z.string()),
})
export type ResolveOut = z.infer<typeof ResolveOut>

export const resolveSystem = `You are identifying exactly which company a recruiter means, for a candidate deciding whether to interview there. Today is ${today()}.
Names collide often: one search for a name can return several unrelated companies that all look plausible. Guessing wrong poisons all later research, so say when you are unsure.`

export const resolvePrompt = (p: ParseOut, companyDomain?: string) => `TASK
Establish which company this is: legal name, primary website domain, headquarters, founded year, and whether it is publicly listed.
${companyDomain ? `The user has confirmed the company is the one whose website is ${companyDomain}. Research that company.` : `List every plausible company the text could mean, with its domain, and say how confident you are (0 to 1) that each is the one meant and why. Use the role, location, recruiter and any domain in the text to tell them apart. A bare common name with nothing to separate candidates is low confidence.`}

WHAT THE TEXT SAYS
<recruiter_text>
company: ${p.company_name ?? '(not named)'}
domain seen in text: ${p.domain_guess ?? '(none)'}
role: ${p.role.title}${p.role.level_claimed ? ` (${p.role.level_claimed})` : ''}
location: ${p.role.location ?? '(not stated)'}
recruiter: ${[p.recruiter.name, p.recruiter.agency].filter(Boolean).join(', ') || '(not stated)'}
requirements: ${p.role.extracted_requirements.slice(0, 8).join('; ') || '(none)'}
</recruiter_text>

${researchRules(MAX_SEARCHES)}`

export async function resolve(p: ParseOut, budget: Budget, companyDomain?: string): Promise<{ out: ResolveOut; dropped: string[] }> {
  const { data, dropped } = await researchStage({
    stage: 'resolve',
    budget,
    system: resolveSystem,
    prompt: resolvePrompt(p, companyDomain),
    maxSearches: MAX_SEARCHES,
    task: resolveTask(companyDomain),
    schema: ResolveOut,
  })
  return { out: data, dropped }
}

export const resolveTask = (companyDomain?: string) =>
  `candidates: every plausible company named in the notes, most likely first; reason: one plain sentence a person can read, saying what matches or does not, with no [n] markers and no comment on the confidence number. identity: the most likely candidate, with resolution_confidence equal to its confidence; identity is null only if there is no candidate at all. Within identity, set legal_name, hq, founded_year or is_public to null when no quote states it, and say so in gaps.${companyDomain ? ` The user confirmed the domain is ${companyDomain}.` : ''}`

/** The gate. Below the threshold the run stops and the user picks; a user-supplied domain must match what was resolved. */
export function gate(out: ResolveOut, companyDomain?: string): 'pass' | 'ask' | 'mismatch' {
  if (companyDomain) return out.identity?.domain === companyDomain ? 'pass' : 'mismatch'
  return out.identity && out.identity.resolution_confidence >= RESOLVE_THRESHOLD ? 'pass' : 'ask'
}
