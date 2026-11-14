// Plain constants (no zod), so the browser can import them without the validation library.

export const PIPELINE = ['new', 'interested', 'screening', 'interviewing', 'offer', 'back_pocket', 'on_hold', 'passed', 'closed'] as const
export type Pipeline = (typeof PIPELINE)[number]

/** Active stages move forward; parked ones are deliberate pauses; closed ones end it and say why. */
export const PIPELINE_GROUPS = {
  active: ['new', 'interested', 'screening', 'interviewing', 'offer'],
  parked: ['back_pocket', 'on_hold'],
  closed: ['passed', 'closed'],
} as const satisfies Record<string, readonly Pipeline[]>

/** You said no. */
export const PASS_REASONS = ['comp', 'level', 'role_fit', 'company_risk', 'location', 'domain', 'timing', 'took_another', 'other'] as const
/** It ended from their side. */
export const CLOSE_REASONS = ['not_selected', 'role_filled', 'went_silent', 'role_cancelled', 'other'] as const
export type PipelineReason = (typeof PASS_REASONS)[number] | (typeof CLOSE_REASONS)[number]
