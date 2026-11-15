import { z } from 'zod'
import { StageName } from './research'

/** The parts of a call that vary by kind. Defaults let older or partial rows parse. */
export const CallDetail = z.object({
  // search calls
  queries: z.array(z.string()).default([]),
  found: z.int().nullable().default(null), // distinct pages the searches returned
  cited: z.int().nullable().default(null), // of those, how many the notes cite
  capped: z.boolean().default(false), // stopped at its search limit
  suspect: z.array(z.string()).default([]), // phrases in cited quotes that read like instructions to an AI
  // structured calls
  attempt: z.int().default(1),
  outcome: z.enum(['valid', 'invalid', 'cut_off']).nullable().default(null),
  issues: z.string().nullable().default(null),
  dropped: z.array(z.string()).default([]),
})
export type CallDetail = z.infer<typeof CallDetail>

/** One model call in a run, as the run inspector shows it. */
export const CallTrace = z.object({
  stage: StageName,
  kind: z.enum(['search', 'structured']),
  model: z.string(),
  at: z.iso.datetime(),
  ms: z.int(),
  cached: z.boolean(),
  usd: z.number(),
  input_tokens: z.int(),
  output_tokens: z.int(),
  searches: z.int(),
  detail: CallDetail,
})
export type CallTrace = z.infer<typeof CallTrace>
export type CallRecord = z.input<typeof CallTrace>
