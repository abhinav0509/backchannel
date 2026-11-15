import { describe, expect, it } from 'vitest'
import { roundIcs } from './ics'

const round = { id: 'r1', kind: 'hiring_manager' as const, at: '2026-11-18T09:30:00.000Z', format: 'video' as const, interviewers: ['Riya, Design Lead', 'Sam'], notes: '', outcome: 'pending' as const, created_at: '2026-11-15T00:00:00.000Z' }

describe('roundIcs', () => {
  const ics = roundIcs(round, { company: 'Example; Inc', role: 'Designer', url: 'https://app.example/o/1?tab=prep' }, new Date('2026-11-15T12:00:00Z'))

  it('is a one-hour calendar event in UTC with a stable id', () => {
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/)
    expect(ics).toContain('DTSTART:20261118T093000Z')
    expect(ics).toContain('DTEND:20261118T103000Z')
    expect(ics).toContain('UID:r1@backchannel')
    expect(ics).toContain('DTSTAMP:20261115T120000Z')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })

  it('names the round, escapes text, and links back to the prep', () => {
    expect(ics).toContain('SUMMARY:Hiring manager: Example\; Inc')
    expect(ics).toContain('Riya\\, Design Lead')
    expect(ics).toContain('https://app.example/o/1?tab=prep')
  })

  it('needs a date', () => expect(() => roundIcs({ ...round, at: null }, { company: 'X', role: null, url: 'u' })).toThrow(/not scheduled/))
})
