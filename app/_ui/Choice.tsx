'use client'

import { useState } from 'react'
import type { Opportunity } from '../../src/store/repo'

const DOMAIN = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/

/** The one interruption in the flow: the point where a wrong guess would poison everything after it. */
export function Choice({ o, onChoose }: { o: Opportunity; onChoose: (domain: string) => void }) {
  // Nothing is preselected unless research is fairly sure: this is the one place a guess must be the user's.
  const top = o.candidates[0]
  const [picked, setPicked] = useState<string>(top && top.confidence >= 0.6 ? top.domain : '')
  const [other, setOther] = useState('')
  const typed = other.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const domain = typed || picked
  const valid = DOMAIN.test(domain)

  return (
    <section className="mb-12 rounded-[22px] border border-line-soft bg-surface p-6">
      <h2 className="t-title">Which company is this?</h2>
      <p className="mt-2 max-w-[60ch] t-small text-ink-2">
        Several companies match, and researching the wrong one would make the whole report wrong. Pick the one the recruiter means.
      </p>

      <fieldset className="mt-5 space-y-2">
        <legend className="sr-only">Candidate companies</legend>
        {o.candidates.map((c) => (
          <label
            key={c.domain}
            className={`grid cursor-pointer grid-cols-[18px_1fr_auto] items-start gap-3 rounded-2xl border p-4 transition-colors duration-150 ${
              !typed && picked === c.domain ? 'border-accent bg-accent-soft/60' : 'border-line-soft hover:border-line'
            }`}
          >
            <input
              type="radio"
              name="candidate"
              className="mt-1 accent-[var(--accent)]"
              checked={!typed && picked === c.domain}
              onChange={() => {
                setPicked(c.domain)
                setOther('')
              }}
            />
            <span>
              <span className="block font-medium">{c.name}</span>
              <span className="block t-small text-ink-3">{c.domain}</span>
              <span className="mt-1 block t-small text-ink-2">{c.reason}</span>
            </span>
            <span className="t-micro tabular-nums text-ink-3" title="How likely this is the company the email means">
              {Math.round(c.confidence * 100)}% likely
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mt-4">
        <label htmlFor="other-domain" className="t-small text-ink-2">
          None of these? Enter the company’s website.
        </label>
        <input
          id="other-domain"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder="example.com"
          className="mt-1.5 block h-10 w-full max-w-sm rounded-xl border border-line bg-canvas px-3 t-small outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent/60 focus:shadow-[0_0_0_4px_var(--accent-soft)]"
        />
      </div>

      <button className="btn btn-primary mt-6" disabled={!valid} onClick={() => onChoose(domain)}>
        Research {valid ? domain : 'this company'}
      </button>
      {o.choice_reason && <p className="mt-3 t-micro text-ink-3">Stopped because {o.choice_reason}.</p>}
    </section>
  )
}
