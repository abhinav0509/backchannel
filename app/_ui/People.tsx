'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Member } from '../../src/server/members'
import { usd } from '../_lib/format'
import { Monogram } from './Monogram'

/** Invite friends and family, see who has started, what they have spent, and take access away. */
export function People({ capUsd }: { capUsd: number }) {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | { sent: string } | { error: string }>('idle')
  const [removing, setRemoving] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/members', { cache: 'no-store' }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as Member[] | { error?: string } | null
    if (res?.ok && Array.isArray(body)) setMembers(body)
    else setSetupError((body as { error?: string } | null)?.error ?? 'Could not load the people you invited.')
  }, [])
  useEffect(() => void load(), [load])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    const res = await fetch('/api/members', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, ...(name.trim() && { name }) }) }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as { error?: string } | null
    if (!res?.ok) return setState({ error: body?.error ?? 'The invitation could not be sent.' })
    setState({ sent: email.trim() })
    setEmail('')
    setName('')
    void load()
  }

  async function remove(id: string) {
    const res = await fetch(`/api/members/${id}`, { method: 'DELETE' }).catch(() => null)
    setRemoving(null)
    if (res?.ok) setMembers((xs) => xs?.filter((m) => m.id !== id) ?? null)
  }

  return (
    <div className="max-w-[760px] pt-8 lg:pt-10">
      <h1 className="t-display">People</h1>
      <p className="mt-2 max-w-[56ch] text-ink-2">
        Invite friends and family to try Backchannel. Each gets an email to set up, starts by adding their CV, and can spend up to {usd(capUsd)} of your research credit a month. Their research is private to them.
      </p>

      <form onSubmit={invite} className="card mt-8 grid gap-3 p-5 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <label className="block">
          <span className="t-small font-medium">
            Name <span className="font-normal text-ink-3">optional</span>
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Asha" className="field mt-1.5" />
        </label>
        <label className="block">
          <span className="t-small font-medium">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" className="field mt-1.5" />
        </label>
        <button className="btn btn-primary h-[42px]" disabled={state === 'sending' || !email}>
          {state === 'sending' ? 'Sending…' : 'Send invitation'}
        </button>
        <p className="t-small sm:col-span-3" aria-live="polite">
          {typeof state === 'object' && 'sent' in state && <span className="text-green">Invitation sent to {state.sent}.</span>}
          {typeof state === 'object' && 'error' in state && <span className="text-risk">{state.error}</span>}
        </p>
      </form>

      <section aria-labelledby="invited" className="mt-10">
        <h2 id="invited" className="t-title">
          Invited
        </h2>
        {setupError ? (
          <p className="mt-3 rounded-[12px] bg-amber-soft px-4 py-3 t-small text-ink-2">{setupError}</p>
        ) : members === null ? (
          <p className="mt-3 t-small text-ink-3">Loading…</p>
        ) : members.length === 0 ? (
          <p className="mt-3 t-small text-ink-3">Nobody yet. Invitations you send appear here.</p>
        ) : (
          <ul className="card mt-4 divide-y divide-line-soft px-5">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-4 py-4">
                <Monogram name={m.name ?? m.email} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name ?? m.email}</p>
                  <p className="truncate t-small text-ink-3">
                    {m.name && <span>{m.email} </span>}
                    <span className={m.status === 'active' ? 'text-green' : 'text-amber'}>{m.status === 'active' ? 'Signed in' : 'Invitation not yet accepted'}</span>
                  </p>
                </div>
                <div className="w-32" title={`${usd(m.spent_usd)} of ${usd(capUsd)} this month`}>
                  <p className="t-micro text-ink-3">
                    <span className="font-semibold text-ink-2">{usd(m.spent_usd)}</span> of {usd(capUsd)}
                  </p>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
                    <span className="meter block h-full rounded-full bg-ink-3" style={{ width: `${Math.min(100, (m.spent_usd / capUsd) * 100)}%` }} />
                  </span>
                </div>
                {removing === m.id ? (
                  <span className="flex items-center gap-1.5">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRemoving(null)}>
                      Keep
                    </button>
                    <button type="button" className="btn btn-sm bg-risk text-white hover:opacity-90" onClick={() => void remove(m.id)}>
                      Remove and delete their research
                    </button>
                  </span>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRemoving(m.id)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
