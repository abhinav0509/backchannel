import { z } from 'zod'
import { claim, Contact, Role } from '../types/research'
import type { Budget } from '../util/cost'
import { companyLine, researchRules, researchStage, today } from './shared'

const MAX_SEARCHES = 5

export const ContactsOut = z.object({ contacts: z.array(claim(Contact)).max(6), gaps: z.array(z.string()) })
export type ContactsOut = z.infer<typeof ContactsOut>

type Role = z.infer<typeof Role>

export interface ContactsInput {
  display_name: string
  domain: string
  role?: Role
  recruiter?: { name: string | null; agency: string | null } | null
}

export const contactsSystem = `You find the few people a candidate should know about before interviewing for a specific role. Today is ${today()}. You are careful about identity: two people can share a name, and a profile is only a match when a source ties that person to this company.`

const roleLine = (r: Role | undefined) =>
  r?.title ? `The role is ${[r.level_claimed && !r.title.toLowerCase().includes(r.level_claimed.toLowerCase()) ? r.level_claimed : null, r.title].filter(Boolean).join(' ')}${r.location ? `, based in ${r.location}` : ''}.` : 'No specific role is known yet; look for the design and product leadership only.'

export const contactsPrompt = (c: ContactsInput) => `You are researching ${companyLine(c)}

${roleLine(c.role)}${c.recruiter?.name ? `\nThe recruiter who reached out is ${c.recruiter.name}${c.recruiter.agency ? ` of ${c.recruiter.agency}` : ''}.` : ''}

TASK
Find, for this role only:
- The likely hiring manager: the person who leads the team or discipline this role sits in, at this location where possible.
- The leadership directly above the role, for example the head of design or product for that area.
${c.recruiter?.name ? '- The recruiter named above: confirm their current title and whether they work for the company or an agency.\n' : ''}- At most two senior people on the same team, only if a source clearly places them there.

Search the web for public professional profiles, including LinkedIn profiles that appear in search results; use the search result itself and do not open LinkedIn pages. Work information only: name, current title, team and location. No personal contact details, no personal life. Do not list employees who are not tied to this role.

For each person, say whether a source names them with this company and their current title (a confirmed match) or the link is weaker (a possible match), and why they matter to the candidate.

${researchRules(MAX_SEARCHES).replace('- Do not rely on Glassdoor, LinkedIn, AmbitionBox or Blind pages directly. Search result snippets that quote them are acceptable.\n', '- Do not open Glassdoor, LinkedIn, AmbitionBox or Blind pages. Their search results and snippets are acceptable.\n')}`

export const contactsTask = `contacts: one claim per person, at most 6. relation: hiring_manager, leadership_above_role, recruiter or team. match: confirmed only when a cited snippet names the person with this company and a current title, otherwise possible. title null if not shown. why: one sentence on why they matter for this role. When a LinkedIn profile URL is among a person's sources, include it as one of that claim's evidence entries. Give each claim at most two evidence entries.`

// Constrained: the schema is small enough for the grammar (probed 2026-11-14), and unconstrained
// output nested gaps inside the contacts list and broke the JSON three times running.
export async function contacts(c: ContactsInput, budget: Budget) {
  return researchStage({ stage: 'contacts', budget, system: contactsSystem, prompt: contactsPrompt(c), maxSearches: MAX_SEARCHES, task: contactsTask, schema: ContactsOut })
}
