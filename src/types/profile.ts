import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'
import { ScoreDimension } from './research.js'

// PRD section 5.4 defaults, in percent.
export const DEFAULT_WEIGHTS = {
  role_fit: 30,
  company_health: 15,
  job_security: 20,
  career_signal: 15,
  culture: 10,
  comp_confidence: 10,
} as const satisfies Record<z.infer<typeof ScoreDimension>, number>

export const Profile = z.object({
  headline: z.string(),
  years_experience: z.number().nonnegative(),
  current_level: z.string().nullable().default(null),
  target_levels: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  domains_of_interest: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  work_policy: z.enum(['onsite', 'hybrid', 'remote', 'any']).default('any'),
  constraints: z.array(z.string()).default([]),
  projects: z.array(z.object({ name: z.string(), summary: z.string() })).default([]),
  weights: z.record(ScoreDimension, z.number().nonnegative()).default({ ...DEFAULT_WEIGHTS }),
})
export type Profile = z.infer<typeof Profile>

/** null when there is no profile yet; a malformed profile throws rather than being half-used. */
export function loadProfile(file = 'profile.json'): Profile | null {
  return existsSync(file) ? Profile.parse(JSON.parse(readFileSync(file, 'utf8'))) : null
}
