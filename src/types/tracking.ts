import { z } from 'zod'

import { CLOSE_REASONS, PASS_REASONS, PIPELINE } from './pipeline'

export { CLOSE_REASONS, PASS_REASONS, PIPELINE, PIPELINE_GROUPS } from './pipeline'
export const Pipeline = z.enum(PIPELINE)
export type Pipeline = z.infer<typeof Pipeline>
export const PipelineReason = z.enum([...PASS_REASONS, ...CLOSE_REASONS])
export type PipelineReason = z.infer<typeof PipelineReason>

/** What you noted against one interview question: keyed by the question's text, so a re-run keeps answers to questions it repeats. */
export const PrepEntry = z.object({ asked: z.boolean(), answer: z.string().max(4000) })
export type PrepEntry = z.infer<typeof PrepEntry>

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

/** The fields you edit by hand. A reason only belongs to a closing stage, and must fit the side that closed it. */
export const TrackingPatch = z
  .object({
    pipeline: Pipeline,
    pipeline_reason: PipelineReason.nullable(),
    notes: z.string().max(20_000),
    next_step: z.string().trim().max(200).nullable(),
    next_step_at: Day.nullable(),
    prep: z.record(z.string().min(1).max(1000), PrepEntry).refine((p) => Object.keys(p).length <= 40, 'at most 40 prep entries'),
  })
  .partial()
  .strict()
  .refine((p) => !p.pipeline_reason || p.pipeline === 'passed' || p.pipeline === 'closed', {
    message: 'a reason is only recorded when passing or closing',
    path: ['pipeline_reason'],
  })
  .refine(
    (p) =>
      !p.pipeline_reason ||
      (p.pipeline === 'passed' ? (PASS_REASONS as readonly string[]) : (CLOSE_REASONS as readonly string[])).includes(p.pipeline_reason),
    { message: 'that reason belongs to the other way of closing', path: ['pipeline_reason'] },
  )
export type TrackingPatch = z.infer<typeof TrackingPatch>
