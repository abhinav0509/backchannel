'use client'

import { useState } from 'react'
import type { Question, QuestionTopic } from '../../../src/types/research'
import type { PrepEntry } from '../../../src/types/tracking'
import { SaveState, useAutosave } from './Tracker'

const TOPICS: Record<QuestionTopic, string> = {
  role: 'The role',
  team: 'The team',
  culture: 'How they work',
  company: 'The company',
  money: 'Money and stability',
  future: 'Where it is heading',
  ai: 'AI',
  comp: 'Pay and terms',
}
const ORDER = Object.keys(TOPICS) as QuestionTopic[]

function Item({ q, entry, onChange }: { q: Question; entry: PrepEntry | undefined; onChange: (e: PrepEntry) => void }) {
  const asked = entry?.asked ?? false
  const [copied, setCopied] = useState(false)
  return (
    <li className={`card p-4 transition-colors duration-150 ${asked ? 'bg-raised' : ''}`}>
      <div className="grid grid-cols-[22px_1fr_auto] items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={asked}
          aria-label={asked ? 'Mark as not asked' : 'Mark as asked'}
          onClick={() => onChange({ asked: !asked, answer: entry?.answer ?? '' })}
          className={`mt-0.5 grid h-[20px] w-[20px] place-items-center rounded-[6px] transition-[background-color,box-shadow] duration-150 ${asked ? 'bg-accent text-accent-ink' : 'shadow-[inset_0_0_0_1.5px_var(--line-strong)] hover:shadow-[inset_0_0_0_1.5px_var(--accent)]'}`}
        >
          {asked && (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="fill-in">
              <path d="m2.5 6.2 2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <div className="min-w-0">
          <p className={`font-medium leading-snug ${asked ? 'text-ink-2' : ''}`}>{q.question}</p>
          {q.why && <p className="mt-1 t-small text-ink-3">{q.why}</p>}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm -mt-1 -mr-1"
          onClick={() => {
            void navigator.clipboard?.writeText(q.question).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            })
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="reveal" data-open={asked}>
        <div>
          <label className="mt-3 block pl-[34px]">
            <span className="sr-only">What they said</span>
            <textarea
              value={entry?.answer ?? ''}
              onChange={(e) => onChange({ asked: true, answer: e.target.value })}
              placeholder="What they said"
              rows={2}
              maxLength={4000}
              tabIndex={asked ? 0 : -1}
              className="field field-sizing-content min-h-[64px] resize-none text-[14px]"
            />
          </label>
        </div>
      </div>
    </li>
  )
}

/**
 * Interview prep from what research found and could not find. Tick a question off as you ask
 * it and note the answer; answers are kept by question, so a re-run keeps the ones it repeats.
 */
export function Prep({ id, questions, gaps, initial, onChange }: { id: string; questions: Question[]; gaps: string[]; initial: Record<string, PrepEntry>; onChange?: (prep: Record<string, PrepEntry>) => void }) {
  const [prep, setPrep] = useState(initial)
  const { state, save } = useAutosave(id)
  const [copied, setCopied] = useState(false)
  const asked = questions.filter((q) => prep[q.question]?.asked).length

  const update = (q: string, e: PrepEntry) => {
    // Keep only entries for questions on screen, so stale answers never crowd out new ones.
    const next = Object.fromEntries(Object.entries({ ...prep, [q]: e }).filter(([k, v]) => questions.some((x) => x.question === k) && (v.asked || v.answer)))
    setPrep(next)
    onChange?.(next)
    save({ prep: next }, e.asked !== prep[q]?.asked ? 0 : 700)
  }

  if (!questions.length)
    return (
      <div className="card mx-auto max-w-[560px] p-8 text-center">
        <p className="t-title">No questions yet</p>
        <p className="mt-2 t-small text-ink-2">Full research writes questions from what it finds and what it cannot establish.</p>
      </div>
    )

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="t-lede">
            {asked === 0 ? `${questions.length} questions worth asking` : `${asked} of ${questions.length} asked`}
          </p>
          <span className="mt-2 block h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-sunken" aria-hidden>
            <span className="meter block h-full rounded-full bg-accent" style={{ width: `${(asked / questions.length) * 100}%` }} />
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SaveState state={state} />
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => {
              const text = ORDER.flatMap((t) => {
                const qs = questions.filter((q) => q.topic === t)
                return qs.length ? [`${TOPICS[t]}`, ...qs.map((q) => `- ${q.question}`), ''] : []
              }).join('\n')
              void navigator.clipboard?.writeText(text).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1400)
              })
            }}
          >
            {copied ? 'Copied' : 'Copy all'}
          </button>
        </div>
      </header>

      {ORDER.map((t) => {
        const qs = questions.filter((q) => q.topic === t)
        if (!qs.length) return null
        return (
          <section key={t} aria-labelledby={`topic-${t}`}>
            <h2 id={`topic-${t}`} className="mb-3 font-semibold">
              {TOPICS[t]}
            </h2>
            <ul className="space-y-2">
              {qs.map((q) => (
                <Item key={q.question} q={q} entry={prep[q.question]} onChange={(e) => update(q.question, e)} />
              ))}
            </ul>
          </section>
        )
      })}

      {gaps.length > 0 && (
        <section aria-labelledby="unknowns" className="rounded-[16px] bg-sunken p-5">
          <h2 id="unknowns" className="font-semibold">
            Also unknown
          </h2>
          <p className="t-micro text-ink-3">Research could not establish these. If it matters to you, ask.</p>
          <ul className="mt-3 space-y-1.5">
            {gaps.slice(0, 8).map((g) => (
              <li key={g} className="t-small text-ink-2">
                {g}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
