'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Popover } from './Popover'
import { Button } from './Button'

/** Tell the person running Backchannel what works and what does not, from wherever you are. */
export function Feedback({ compact = false }: { compact?: boolean }) {
  const path = usePathname()
  const query = useSearchParams().toString()
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | { error: string }>('idle')

  async function send(close: () => void) {
    setState('sending')
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page: query ? `${path}?${query}` : path, message }),
    }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as { error?: string } | null
    if (!res?.ok) return setState({ error: body?.error ?? 'Could not send. Try again.' })
    setState('sent')
    setMessage('')
    setTimeout(() => {
      close()
      setState('idle')
    }, 1400)
  }

  return (
    <Popover
      label="Send feedback"
      align={compact ? 'end' : 'start'}
      side={compact ? 'bottom' : 'top'}
      width={300}
      trigger={() => <span className="btn btn-ghost btn-sm">Feedback</span>}
      className={compact ? '' : 'inline-block'}
    >
      {(close) =>
        state === 'sent' ? (
          <p className="fill-in p-3 t-small font-medium text-green">Thank you, it has been sent.</p>
        ) : (
          <form
            className="p-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send(close)
            }}
          >
            <label htmlFor="feedback" className="t-small font-semibold">
              What works, what does not?
            </label>
            <p className="t-micro text-ink-3">The page you are on is attached, so you can be brief.</p>
            <textarea
              id="feedback"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void send(close)
                }
              }}
              rows={4}
              maxLength={2000}
              placeholder="The questions tab helped. The fit felt off because…"
              className="field mt-2 resize-none text-[14px]"
            />
            {typeof state === 'object' && <p className="mt-2 t-micro text-risk">{state.error}</p>}
            <div className="mt-2 flex justify-end">
              <Button className="btn-primary btn-sm" pending={state === 'sending'} pendingLabel="Sending" disabled={!message.trim()}>
                Send
              </Button>
            </div>
          </form>
        )
      }
    </Popover>
  )
}
