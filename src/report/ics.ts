import type { Round } from '../types/tracking'

export const ROUND_LABEL: Record<Round['kind'], string> = {
  recruiter_screen: 'Recruiter screen',
  hiring_manager: 'Hiring manager',
  portfolio_review: 'Portfolio review',
  design_exercise: 'Design exercise',
  panel: 'Panel',
  onsite: 'Onsite',
  final: 'Final round',
  other: 'Interview',
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
// RFC 5545 text: backslash, semicolon, comma and newlines are escaped.
const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** A calendar event for a scheduled round, one hour long, linking back to its prep. */
export function roundIcs(r: Round, ctx: { company: string; role: string | null; url: string }, now = new Date()): string {
  if (!r.at) throw new Error('the round is not scheduled yet')
  const start = new Date(r.at)
  const description = [
    ctx.role && `Role: ${ctx.role}`,
    r.interviewers.length > 0 && `With: ${r.interviewers.join('; ')}`,
    `Format: ${r.format}`,
    `Prep: ${ctx.url}`,
  ].filter(Boolean) as string[]
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Backchannel//Interview rounds//EN',
    'BEGIN:VEVENT',
    `UID:${r.id}@backchannel`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(new Date(start.getTime() + 3_600_000))}`,
    `SUMMARY:${text(`${ROUND_LABEL[r.kind]}: ${ctx.company}`)}`,
    `DESCRIPTION:${text(description.join('\n'))}`,
    `URL:${ctx.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
