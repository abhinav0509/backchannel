import { describe, expect, it } from 'vitest'
import { agenda } from './agenda'

const NOW = Date.parse('2026-11-15T12:00:00Z')
const h = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString()
const round = (id: string, at: string | null, outcome = 'pending') => ({ id, kind: 'panel' as const, at, format: 'video' as const, interviewers: [], notes: '', outcome: outcome as 'pending', created_at: h(-500) })
const opp = (id: string, rounds: ReturnType<typeof round>[], researchedHoursAgo: number | null = 24) =>
  ({ id, company: `Co ${id}`, role: 'Designer', rounds, report: researchedHoursAgo === null ? null : { generated_at: h(-researchedHoursAgo) }, triage: null }) as never

describe('agenda', () => {
  it('lists rounds in the next day and a half, soonest first, with how old the research is', () => {
    const a = agenda([opp('a', [round('r1', h(30)), round('r2', h(48))]), opp('b', [round('r3', h(3))], 24 * 9)], NOW)
    expect(a.filter((x) => x.type === 'upcoming').map((x) => [x.round.id, x.research_days])).toEqual([
      ['r3', 9],
      ['r1', 1],
    ])
  })

  it('asks how it went for rounds that have happened without an outcome, newest first, for two weeks', () => {
    const a = agenda([opp('a', [round('old', h(-24 * 20)), round('done', h(-5), 'passed'), round('r4', h(-26)), round('r5', h(-4))])], NOW)
    expect(a.filter((x) => x.type === 'follow_up').map((x) => x.round.id)).toEqual(['r5', 'r4'])
  })

  it('ignores unscheduled rounds, and a round still in its first hour stays upcoming', () => {
    const a = agenda([opp('a', [round('u', null), round('now', h(-0.5))])], NOW)
    expect(a.map((x) => [x.type, x.round.id])).toEqual([['upcoming', 'now']])
  })
})
