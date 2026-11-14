import { CLOSE_REASONS, PASS_REASONS, PIPELINE_GROUPS, type Pipeline, type PipelineReason } from '../../src/types/pipeline'

type Tone = 'neutral' | 'accent' | 'sky' | 'green' | 'amber' | 'muted'

/** What each stage means to you, in your words. Shown in the picker, so the choice is never a guess. */
export const STAGE: Record<Pipeline, { label: string; hint: string; tone: Tone }> = {
  new: { label: 'New', hint: 'Just arrived. Not decided yet.', tone: 'neutral' },
  interested: { label: 'Interested', hint: 'Worth pursuing. Reply or apply.', tone: 'accent' },
  screening: { label: 'Screening', hint: 'Talking to the recruiter or a first call.', tone: 'sky' },
  interviewing: { label: 'Interviewing', hint: 'In the interview loop.', tone: 'sky' },
  offer: { label: 'Offer', hint: 'An offer is on the table.', tone: 'green' },
  back_pocket: { label: 'Back pocket', hint: 'Good, but not now. Keep it warm.', tone: 'amber' },
  on_hold: { label: 'On hold', hint: 'Paused, by you or by them.', tone: 'muted' },
  passed: { label: 'Passed', hint: 'You said no.', tone: 'muted' },
  closed: { label: 'Closed', hint: 'It ended from their side.', tone: 'muted' },
}

export const GROUPS: { key: keyof typeof PIPELINE_GROUPS; label: string; stages: readonly Pipeline[] }[] = [
  { key: 'active', label: 'In play', stages: PIPELINE_GROUPS.active },
  { key: 'parked', label: 'Parked', stages: PIPELINE_GROUPS.parked },
  { key: 'closed', label: 'Closed', stages: PIPELINE_GROUPS.closed },
]

export const REASON: Record<PipelineReason, string> = {
  comp: 'Pay too low',
  level: 'Wrong level',
  role_fit: 'Role is not a fit',
  company_risk: 'Company risk',
  location: 'Location or office policy',
  domain: 'Not my domain',
  timing: 'Bad timing',
  took_another: 'Took another offer',
  not_selected: 'Not selected',
  role_filled: 'Role filled',
  went_silent: 'They went silent',
  role_cancelled: 'Role cancelled',
  other: 'Other',
}
export const reasonsFor = (p: Pipeline): readonly PipelineReason[] => (p === 'passed' ? PASS_REASONS : p === 'closed' ? CLOSE_REASONS : [])

/** Colour for a stage dot: accent and sky for momentum, amber for parked, grey for done. */
export const toneVar: Record<Tone, string> = {
  neutral: 'var(--ink-3)',
  accent: 'var(--accent)',
  sky: 'var(--sky)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  muted: 'var(--line-strong)',
}
