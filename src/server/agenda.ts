import type { Round } from '../types/tracking'

type Opp = { id: string; company: string | null; role: string | null; rounds: Round[]; report: { generated_at: string } | null; triage: { generated_at: string } | null }

export type AgendaItem = {
  type: 'upcoming' | 'follow_up'
  opportunity: { id: string; company: string | null; role: string | null }
  round: Pick<Round, 'id' | 'kind' | 'at' | 'interviewers'>
  research_days: number | null // how old the research is, to nudge a refresh before a round
}

const HOUR = 3_600_000
const AHEAD = 36 * HOUR // tomorrow, whenever today is
const LOOKBACK = 14 * 24 * HOUR // past that, an unlogged round is history, not a to-do

/** What needs you now: rounds coming up, and rounds that happened without an outcome logged. */
export function agenda(opps: Opp[], now = Date.now()): AgendaItem[] {
  const out: AgendaItem[] = []
  for (const o of opps) {
    const researched = o.report?.generated_at ?? o.triage?.generated_at
    const research_days = researched ? Math.floor((now - Date.parse(researched)) / (24 * HOUR)) : null
    for (const r of o.rounds) {
      if (!r.at || r.outcome !== 'pending') continue
      const t = Date.parse(r.at)
      // A round counts as upcoming until an hour after it starts.
      const type = t > now - HOUR && t <= now + AHEAD ? 'upcoming' : t <= now - HOUR && t > now - LOOKBACK ? 'follow_up' : null
      if (type) out.push({ type, opportunity: { id: o.id, company: o.company, role: o.role }, round: { id: r.id, kind: r.kind, at: r.at, interviewers: r.interviewers }, research_days })
    }
  }
  const time = (x: AgendaItem) => Date.parse(x.round.at!) // non-null: only scheduled rounds are listed
  return [...out.filter((x) => x.type === 'upcoming').sort((a, b) => time(a) - time(b)), ...out.filter((x) => x.type === 'follow_up').sort((a, b) => time(b) - time(a))]
}
