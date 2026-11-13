'use client'

import { useState } from 'react'
import type { Profile } from '../../src/types/profile'
import { DIMENSION_ORDER, dimensionLabel, parseList } from '../_lib/format'

const DEFAULT_WEIGHTS = { role_fit: 30, company_health: 15, job_security: 20, career_signal: 15, culture: 10, comp_confidence: 10 }
const POLICIES = [
  { value: 'any', label: 'Any' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On site' },
] as const

const field =
  'mt-1.5 block w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[17px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent/60 focus:shadow-[0_0_0_4px_var(--accent-soft)]'

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[13rem_1fr] sm:gap-6">
      <div>
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {hint && <p className="t-small text-ink-3">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

/** The candidate profile research is judged against, plus how much each score matters to you. */
export function ProfileForm({ initial }: { initial: Profile | null }) {
  const p = initial
  const [headline, setHeadline] = useState(p?.headline ?? '')
  const [years, setYears] = useState(String(p?.years_experience ?? ''))
  const [level, setLevel] = useState(p?.current_level ?? '')
  const [targets, setTargets] = useState(p?.target_levels.join(', ') ?? '')
  const [skills, setSkills] = useState(p?.skills.join(', ') ?? '')
  const [domains, setDomains] = useState(p?.domains_of_interest.join(', ') ?? '')
  const [locations, setLocations] = useState(p?.locations.join(', ') ?? '')
  const [policy, setPolicy] = useState<Profile['work_policy']>(p?.work_policy ?? 'any')
  const [constraints, setConstraints] = useState(p?.constraints.join('\n') ?? '')
  const [weights, setWeights] = useState<Record<string, number>>({ ...DEFAULT_WEIGHTS, ...p?.weights })
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | { error: string }>('idle')
  const total = Object.values(weights).reduce((a, b) => a + b, 0)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setState('saving')
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        headline: headline.trim(),
        years_experience: Number(years),
        current_level: level.trim() || null,
        target_levels: parseList(targets),
        skills: parseList(skills),
        domains_of_interest: parseList(domains),
        locations: parseList(locations),
        work_policy: policy,
        constraints: parseList(constraints),
        projects: p?.projects ?? [],
        weights,
      }),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    setState(res.ok ? 'saved' : { error: body.error ?? 'Could not save.' })
  }

  return (
    <form onSubmit={save} className="max-w-[760px] pt-14">
      <h1 className="t-display">Your profile</h1>
      <p className="t-lede mt-2 max-w-[44ch] text-ink-2">Role fit and career signal are judged against this. Without it, those two scores stay unknown.</p>

      <div className="mt-10 divide-y divide-line-soft border-y border-line-soft">
        <Field id="headline" label="Headline" hint="One line on what you do.">
          <input id="headline" required value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Senior product designer, AI and developer tools" className={field} />
        </Field>
        <Field id="years" label="Years of experience">
          <input id="years" required inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value.replace(/[^\d.]/g, ''))} className={`${field} w-28 tabular-nums`} />
        </Field>
        <Field id="level" label="Current level" hint="And the levels you would move to.">
          <input id="level" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Senior" className={field} />
          <input aria-label="Target levels" value={targets} onChange={(e) => setTargets(e.target.value)} placeholder="Lead, Staff" className={`${field} mt-2`} />
        </Field>
        <Field id="skills" label="Skills" hint="Separate with commas.">
          <textarea id="skills" rows={2} value={skills} onChange={(e) => setSkills(e.target.value)} className={`${field} field-sizing-content resize-none`} />
        </Field>
        <Field id="domains" label="Interests" hint="Domains you want to work in.">
          <input id="domains" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="developer tools, security, AI" className={field} />
        </Field>
        <Field id="locations" label="Locations">
          <input id="locations" value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="Bengaluru, Remote" className={field} />
          <div role="radiogroup" aria-label="Work policy" className="mt-3 inline-flex rounded-full bg-sunken p-1">
            {POLICIES.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={policy === o.value}
                onClick={() => setPolicy(o.value)}
                className={`h-8 rounded-full px-4 t-small font-medium transition-[background-color,color,box-shadow] duration-150 ${policy === o.value ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-ink-2 hover:text-ink'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>
        <Field id="constraints" label="Constraints" hint="One per line.">
          <textarea id="constraints" rows={2} value={constraints} onChange={(e) => setConstraints(e.target.value)} placeholder="No relocation outside India" className={`${field} field-sizing-content resize-none`} />
        </Field>
      </div>

      <section className="mt-14" aria-labelledby="weights">
        <div className="flex items-baseline justify-between">
          <h2 id="weights" className="t-title">
            What matters to you
          </h2>
          <span className={`t-small tabular-nums ${total === 100 ? 'text-ink-3' : 'text-amber'}`}>{total} of 100</span>
        </div>
        <p className="mt-1 max-w-[56ch] t-small text-ink-3">How much each score should count when you compare opportunities. Job security matters more on a contract than it will in two years; change it as your situation does.</p>
        <ul className="mt-5 border-t border-line-soft">
          {DIMENSION_ORDER.map((d) => (
            <li key={d} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-4 border-b border-line-soft py-3 sm:grid-cols-[11rem_1fr_3rem]">
              <label htmlFor={`w-${d}`} className="font-medium">
                {dimensionLabel(d)}
              </label>
              <input
                id={`w-${d}`}
                type="range"
                min={0}
                max={50}
                step={5}
                value={weights[d] ?? 0}
                onChange={(e) => setWeights((w) => ({ ...w, [d]: Number(e.target.value) }))}
                className="accent-[var(--accent)]"
              />
              <span className="text-right tabular-nums">{weights[d]}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex items-center gap-4">
        <button className="btn btn-primary" disabled={state === 'saving' || !headline.trim() || years === ''}>
          {state === 'saving' ? 'Saving…' : 'Save profile'}
        </button>
        <span className="t-small" aria-live="polite">
          {state === 'saved' && <span className="text-green">Saved. New research uses it.</span>}
          {typeof state === 'object' && <span className="text-risk">{state.error}</span>}
        </span>
      </div>
    </form>
  )
}
