/**
 * The eval set. Ground truth is written and checked by hand, never generated.
 * A fixture only counts once `checked` is true and its input file exists; until then
 * the runner reports it as NOT READY. A wrong fixture is worse than no fixture.
 *
 * Paths in `expect` are read from the report (outcome 'report') or from the
 * disambiguation result (outcome 'needs_choice'). See evals/assert.ts for the forms.
 */
export interface Fixture {
  name: string
  input: string // relative to evals/fixtures/inputs/
  tests: string
  checked: boolean
  outcome: 'report' | 'needs_choice' // evals always run in deep mode
  expect: Record<string, unknown>
}

export const fixtures: Fixture[] = [
  {
    name: 'sonatype',
    input: 'sonatype.txt',
    tests: 'PE ownership, repeated layoffs, name collides with Sonata Software, Sonatus and Sonix',
    // From the kickoff doc's example. Confirm these, paste a real recruiter email, then set checked: true.
    checked: false,
    outcome: 'report',
    expect: {
      'identity.domain': 'sonatype.com',
      'money.ownership_type.value': 'pe_backed',
      'people.layoff_events.length': { min: 1 },
      'flags[].kind': { contains: ['layoff_history', 'pe_ownership'] },
      'gaps': { contains_match: /compensation/i }, // India comp data does not exist
    },
  },
  {
    name: 'public-co',
    input: 'public-co.txt',
    tests: 'Large public company (Adobe or Atlassian): filings, easy facts, should be fast and confident',
    checked: false,
    outcome: 'report',
    expect: {},
  },
  {
    name: 'startup',
    input: 'startup.txt',
    tests: 'Recently funded startup: funding events, no review data, should return many gaps rather than fill them',
    checked: false,
    outcome: 'report',
    expect: {},
  },
  {
    name: 'indian-services',
    input: 'indian-services.txt',
    tests: 'Indian services company (Infosys or TCS): high review volume, must not be mistaken for a product company',
    checked: false,
    outcome: 'report',
    expect: {},
  },
  {
    name: 'ambiguous',
    input: 'ambiguous.txt',
    tests: 'Deliberately ambiguous name: the disambiguation gate must fire rather than guess',
    // The input is synthetic on purpose (a bare common name, no domain), so no facts to check.
    checked: true,
    outcome: 'needs_choice',
    expect: {
      'candidates.length': { min: 2 },
    },
  },
]
