import type { CompanyResearch } from '../types/research.js'

export interface Candidate {
  name: string
  domain: string
  confidence: number
}

// needs_choice is the stage 1 gate: resolution confidence < 0.8, so the user must pick.
export type RunOutcome =
  | { kind: 'report'; report: CompanyResearch }
  | { kind: 'needs_choice'; candidates: Candidate[] }

export async function runResearch(_input: { text: string; companyDomain?: string }): Promise<RunOutcome> {
  throw new Error('not implemented: the pipeline lands with stages 0 and 1')
}
