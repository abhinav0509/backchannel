'use client'

import { useState } from 'react'
import { ROUND_LABEL } from '../../../src/report/ics'
import type { Question } from '../../../src/types/research'
import { ROUND_KINDS, type PrepEntry, type Round } from '../../../src/types/tracking'
import { questionsForRound } from '../../_lib/rounds'
import { Button } from '../Button'

const OUTCOME: Record<Round['outcome'], { label: string; cls: string }> = {
  pending: { label: 'Upcoming', cls: 'bg-sky-soft text-sky' },
  passed: { label: 'Passed', cls: 'bg-green-soft text-green' },
  rejected: { label: 'Not through', cls: 'bg-risk-soft text-risk' },
  withdrawn: { label: 'Withdrew', cls: 'bg-sunken text-ink-3' },
}
const FORMAT: Record<Round['format'], string> = { video: 'Video', phone: 'Phone', onsite: 'In person' }

/** ISO to the value a datetime-local input shows, in the viewer's own time zone. */
const toLocal = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not scheduled'

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null)
  return res?.ok ? res : null
}

function RoundItem({
  r,
  questions,
  prep,
  people,
  onChange,
  onDelete,
}: {
  r: Round
  questions: Question[]
  prep: Record<string, PrepEntry>
  people: string[]
  onChange: (r: Round) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)
  const save = async (patch: Partial<Round>) => {
    onChange({ ...r, ...patch })
    const res = await send(`/api/rounds/${r.id}`, 'PATCH', patch)
    setError(!res)
    if (res) onChange((await res.json()) as Round)
  }
  const forRound = questionsForRound(r.kind, questions)
  const listId = `people-${r.id}`
  return (
    <li className="border-b border-line-soft last:border-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-start justify-between gap-3 py-3 text-left">
        <span className="min-w-0">
          <span className="block t-small font-semibold">{ROUND_LABEL[r.kind]}</span>
          <span className="block t-micro text-ink-3" suppressHydrationWarning>
            {when(r.at)}
            {r.interviewers.length > 0 && <span>, with {r.interviewers.join(', ')}</span>}
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 t-micro font-medium ${OUTCOME[r.outcome].cls}`}>{OUTCOME[r.outcome].label}</span>
      </button>
      <div className="reveal" data-open={open}>
        <div>
          <div className="space-y-2.5 pb-4">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="t-micro text-ink-3">Kind</span>
                <select value={r.kind} onChange={(e) => void save({ kind: e.target.value as Round['kind'] })} className="field mt-1 py-1.5 text-[13px]" tabIndex={open ? 0 : -1}>
                  {ROUND_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {ROUND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="t-micro text-ink-3">How</span>
                <select value={r.format} onChange={(e) => void save({ format: e.target.value as Round['format'] })} className="field mt-1 py-1.5 text-[13px]" tabIndex={open ? 0 : -1}>
                  {Object.entries(FORMAT).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="t-micro text-ink-3">When</span>
              <input
                type="datetime-local"
                value={toLocal(r.at)}
                onChange={(e) => void save({ at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="field mt-1 py-1.5 text-[13px] tabular-nums"
                tabIndex={open ? 0 : -1}
              />
            </label>
            <label className="block">
              <span className="t-micro text-ink-3">With</span>
              <input
                list={listId}
                defaultValue={r.interviewers.join(', ')}
                onBlur={(e) => {
                  const names = [...new Set(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 8)
                  if (names.join(',') !== r.interviewers.join(',')) void save({ interviewers: names })
                }}
                placeholder="Names, separated by commas"
                className="field mt-1 py-1.5 text-[13px]"
                tabIndex={open ? 0 : -1}
              />
              <datalist id={listId}>
                {people.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="t-micro text-ink-3">How it went</span>
              <select value={r.outcome} onChange={(e) => void save({ outcome: e.target.value as Round['outcome'] })} className="field mt-1 py-1.5 text-[13px]" tabIndex={open ? 0 : -1}>
                {Object.entries(OUTCOME).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="t-micro text-ink-3">Notes</span>
              <textarea
                defaultValue={r.notes}
                onBlur={(e) => e.target.value !== r.notes && void save({ notes: e.target.value })}
                placeholder="What they asked, what they said, your read."
                rows={3}
                className="field field-sizing-content mt-1 min-h-[72px] resize-none text-[13px]"
                tabIndex={open ? 0 : -1}
              />
            </label>

            {forRound.length > 0 && (
              <div className="rounded-[10px] bg-sunken p-3">
                <p className="t-micro font-semibold text-ink-2">Ask in this round</p>
                <ul className="mt-1.5 space-y-1.5">
                  {forRound.map((q) => (
                    <li key={q.question} className={`grid grid-cols-[12px_1fr] gap-1.5 t-micro ${prep[q.question]?.asked ? 'text-ink-3 line-through' : 'text-ink-2'}`}>
                      <span className="mt-[6px] h-1 w-1 rounded-full bg-ink-3" aria-hidden />
                      {q.question}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              {r.at ? (
                <a href={`/api/rounds/${r.id}/calendar`} className="t-micro font-semibold text-accent hover:underline" tabIndex={open ? 0 : -1}>
                  Add to calendar
                </a>
              ) : (
                <span className="t-micro text-ink-3">Set a time to add it to your calendar</span>
              )}
              <button type="button" onClick={onDelete} className="t-micro font-medium text-ink-3 hover:text-risk" tabIndex={open ? 0 : -1}>
                Delete round
              </button>
            </div>
            {error && <p className="t-micro text-risk">Not saved. Check your connection.</p>}
          </div>
        </div>
      </div>
    </li>
  )
}

/** Your interview rounds for this opportunity: when, with whom, how it went, and what to ask in each. */
export function Rounds({ oppId, initial, questions, prep, people }: { oppId: string; initial: Round[]; questions: Question[]; prep: Record<string, PrepEntry>; people: string[] }) {
  const [rounds, setRounds] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<Round['kind']>(initial.length ? 'hiring_manager' : 'recruiter_screen')
  const [at, setAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const sorted = [...rounds].sort((a, b) => (a.at ?? '9').localeCompare(b.at ?? '9'))

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await send(`/api/opportunities/${oppId}/rounds`, 'POST', { kind, ...(at && { at: new Date(at).toISOString() }) })
    setSaving(false)
    if (!res) return setError('Could not add the round. Try again.')
    const r = (await res.json()) as Round
    setRounds((xs) => [...xs, r])
    setAdding(false)
    setAt('')
    setError(null)
  }

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Interviews</h2>
        {!adding && (
          <button type="button" className="t-small font-semibold text-accent hover:underline" onClick={() => setAdding(true)}>
            Add a round
          </button>
        )}
      </div>
      {sorted.length === 0 && !adding && <p className="mt-2 t-small text-ink-3">Add each round as it is booked. Each gets its own short list of questions and a calendar invite.</p>}
      {sorted.length > 0 && (
        <ul className="mt-1">
          {sorted.map((r) => (
            <RoundItem
              key={r.id}
              r={r}
              questions={questions}
              prep={prep}
              people={people}
              onChange={(next) => setRounds((xs) => xs.map((x) => (x.id === next.id ? next : x)))}
              onDelete={async () => {
                const before = rounds
                setRounds((xs) => xs.filter((x) => x.id !== r.id))
                if (!(await send(`/api/rounds/${r.id}`, 'DELETE'))) setRounds(before)
              }}
            />
          ))}
        </ul>
      )}
      {adding && (
        <form onSubmit={add} className="fill-in mt-3 space-y-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as Round['kind'])} className="field py-2 text-[14px]" aria-label="Kind of round" autoFocus>
            {ROUND_KINDS.map((k) => (
              <option key={k} value={k}>
                {ROUND_LABEL[k]}
              </option>
            ))}
          </select>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="field py-2 text-[14px] tabular-nums" aria-label="When (optional)" />
          {error && <p className="t-micro text-risk">{error}</p>}
          <div className="flex justify-end gap-1.5">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <Button className="btn-primary btn-sm" pending={saving} pendingLabel="Adding">
              Add round
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
