import { describe, expect, it } from 'vitest'
import { linkedinSearch, profileUrl, roleSearches } from './linkedin'

const role = (title: string, location: string | null = 'Bengaluru') => ({ title, level_claimed: null, location, work_policy: 'hybrid' as const, employment_type: 'permanent' as const, required_years: null, extracted_requirements: [] })

describe('linkedin', () => {
  it('builds a people search that opens in your own LinkedIn session', () => {
    expect(linkedinSearch('Atlassian design manager')).toBe('https://www.linkedin.com/search/results/people/?keywords=Atlassian%20design%20manager')
  })

  it('takes a profile link only from a claim’s evidence, and only a person profile', () => {
    expect(profileUrl([{ url: 'https://news.example/a' }, { url: 'https://in.linkedin.com/in/someone-123' }])).toBe('https://in.linkedin.com/in/someone-123')
    expect(profileUrl([{ url: 'https://www.linkedin.com/company/example' }])).toBeNull()
    expect(profileUrl([{ url: 'https://notlinkedin.com/in/x' }])).toBeNull()
  })

  it('searches for the people around the role: its manager, its leadership and its peers', () => {
    const s = roleSearches('Atlassian', role('Senior Product Designer'))
    expect(s.map((x) => x.keywords)).toEqual(['Atlassian design manager Bengaluru', 'Atlassian head of design', 'Atlassian Senior Product Designer Bengaluru'])
    expect(s[0]!.label).toMatch(/manager/i)
  })

  it('reads the discipline from the title, and copes with no location or a generic title', () => {
    expect(roleSearches('Example', role('Staff Software Engineer', null))[0]!.keywords).toBe('Example engineering manager')
    expect(roleSearches('Example', role('Chief of Staff', null))[0]!.keywords).toBe('Example Chief of Staff')
    expect(roleSearches('Example', role('', null))).toEqual([{ label: 'Design and product leaders', keywords: 'Example head of design' }])
  })
})
