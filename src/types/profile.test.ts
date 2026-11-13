import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_WEIGHTS, loadProfile, Profile } from './profile'

describe('profile', () => {
  it('default weights match the PRD and sum to 100', () => {
    expect(DEFAULT_WEIGHTS).toEqual({ role_fit: 30, company_health: 15, job_security: 20, career_signal: 15, culture: 10, comp_confidence: 10 })
    expect(Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('fills default weights when the file omits them', () => {
    const p = Profile.parse({ headline: 'Product designer', years_experience: 8 })
    expect(p.weights).toEqual(DEFAULT_WEIGHTS)
    expect(p.skills).toEqual([])
  })

  it('loads null when there is no profile file, and rejects a malformed one', () => {
    const d = mkdtempSync(join(tmpdir(), 'bc-prof-'))
    expect(loadProfile(join(d, 'profile.json'))).toBeNull()
    writeFileSync(join(d, 'bad.json'), JSON.stringify({ years_experience: 'eight' }))
    expect(() => loadProfile(join(d, 'bad.json'))).toThrow()
  })

  it('the example profile is valid', () => expect(loadProfile('profile.example.json')).not.toBeNull())
})
