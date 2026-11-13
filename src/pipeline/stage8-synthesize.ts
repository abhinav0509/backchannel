import { z } from 'zod'
import { MODELS } from '../config'
import { collectEvidenceUrls } from '../llm/evidence'
import { callStructured } from '../llm/call'
import type { Profile } from '../types/profile'
import { Flag, Score, ScoreDimension, type CompanyResearch } from '../types/research'
import type { Budget } from '../util/cost'
import { today } from './shared'

export const SynthOut = z.object({
  flags: z.array(Flag),
  scores: z
    .array(Score)
    .length(6)
    .refine((s) => new Set(s.map((x) => x.dimension)).size === 6, 'each of the six dimensions exactly once'),
  questions_to_ask: z.array(z.string()).min(6).max(10),
  verdict: z.string().min(1),
  gaps: z.array(z.string()),
})
export type SynthOut = z.infer<typeof SynthOut>

export type Draft = Omit<CompanyResearch, 'flags' | 'scores' | 'questions_to_ask' | 'verdict'>

export const synthSystem = `You turn sourced company research into a decision aid for one candidate deciding whether to interview. Today is ${today()}.
You are direct. You state the main risk plainly. You never add facts that are not in the research, and you never present an inference as a fact.`

// Only the findings: run bookkeeping changes every run and would only add noise and bust the cache.
const findings = ({ identity, money, people, role, gaps }: Draft) => ({ identity, money, people, role, gaps })

export const synthPrompt = (draft: Draft, profile: Profile | null) => `TASK
From the research below, produce:
- flags: risk and green flags from this fixed taxonomy only: ${Flag.shape.kind.options.join(', ')}.
  basis "web" flags must copy their evidence entries exactly from the research. basis "profile" is only for judgements of the role against the candidate profile (domain_fit, level_mismatch, role_ambiguity, rare_role) and has empty evidence.
  Severity 1 to 5: 5 changes the decision on its own.
- scores: exactly one per dimension (${ScoreDimension.options.join(', ')}), 0 to 100, with a one or two sentence rationale and the evidence URLs behind it (copied from the research). Set unknown true when there is not enough to judge; comp_confidence is unknown unless compensation is actually sourced.
- questions_to_ask: 6 to 10 questions for the interview, each specific to something found or to a gap. No generic questions.
- verdict: 3 to 5 sentences. Lead with the main risk, stated plainly.
- gaps: what could not be established and why it matters for this decision.

CANDIDATE PROFILE
${profile ? JSON.stringify(profile, null, 2) : 'No candidate profile was provided. role_fit and career_signal cannot be judged against the candidate: mark them unknown and say so in gaps.'}

RESEARCH
${JSON.stringify(findings(draft), null, 2)}`

export async function synthesize(input: { draft: Draft; profile: Profile | null }, budget: Budget) {
  return callStructured({
    stage: 'synthesize',
    budget,
    model: MODELS.synthesis,
    system: synthSystem,
    prompt: synthPrompt(input.draft, input.profile),
    schema: SynthOut,
    effort: 'high',
    // Flags and scores may only cite evidence that research stages already sourced.
    retrievedUrls: collectEvidenceUrls(input.draft),
  })
}
