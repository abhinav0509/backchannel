'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Segmented } from './Segmented'

type Source = 'email' | 'company'

/**
 * Adds an opportunity: from what a recruiter sent, or by company name when you want to look
 * someone up first. Opens with N from anywhere.
 */
export function NewResearch({ variant = 'primary', label = 'New research', shortcut = false }: { variant?: 'primary' | 'quiet'; label?: string; shortcut?: boolean }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [source, setSource] = useState<Source>('email')
  const [text, setText] = useState('')
  const [company, setCompany] = useState('')
  const [website, setWebsite] = useState('')
  const [pending, setPending] = useState<'triage' | 'deep' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ready = (source === 'email' ? text.trim() : company.trim()).length > 0 && !pending

  useEffect(() => {
    if (!shortcut) return // one instance owns the N key, or two sheets would open
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing && !dialog.current?.open) {
        e.preventDefault()
        dialog.current?.showModal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcut])

  async function submit(mode: 'triage' | 'deep') {
    if (!ready) return
    setPending(mode)
    setError(null)
    const body = source === 'email' ? { text, mode } : { company, ...(website.trim() && { website }), mode }
    const res = await fetch('/api/opportunities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const out = ((await res?.json().catch(() => ({}))) ?? {}) as { id?: string; error?: string }
    if (!res?.ok || !out.id) {
      setPending(null)
      setError(out.error ?? 'Could not start the research. Check your connection and try again.')
      return
    }
    dialog.current?.close()
    setPending(null)
    setText('')
    setCompany('')
    setWebsite('')
    router.push(`/o/${out.id}`)
  }

  return (
    <>
      <button type="button" className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-quiet'} w-full`} onClick={() => dialog.current?.showModal()}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {label}
        {shortcut && <kbd className="ml-auto hidden rounded-[5px] bg-white/15 px-1.5 font-sans text-[11px] font-semibold lg:inline">N</kbd>}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="new-title"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="sheet m-auto w-[min(640px,calc(100vw-24px))] max-w-none rounded-[20px] bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-transparent"
      >
        <form
          method="dialog"
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault()
            void submit('triage')
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="new-title" className="t-title">
                Research a company
              </h2>
              <p className="mt-1 t-small text-ink-3">Every finding comes back with the source behind it.</p>
            </div>
            <button type="button" aria-label="Close" className="btn btn-ghost btn-sm -mt-1 -mr-2 h-8 w-8 p-0" onClick={() => dialog.current?.close()}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="mt-5">
            <Segmented<Source>
              value={source}
              onChange={setSource}
              options={[
                { value: 'email', label: 'From a recruiter' },
                { value: 'company', label: 'By company name' },
              ]}
            />
          </div>

          {source === 'email' ? (
            <div key="email" className="fill-in mt-4">
              <label htmlFor="new-text" className="sr-only">
                Recruiter email or job description
              </label>
              <textarea
                id="new-text"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void submit(e.shiftKey ? 'deep' : 'triage')
                  }
                }}
                placeholder="Paste the recruiter’s email, a LinkedIn message or the job description"
                rows={8}
                className="field field-sizing-content max-h-[50vh] min-h-[180px] resize-none leading-[1.5]"
              />
            </div>
          ) : (
            <div key="company" className="fill-in mt-4 grid gap-3 sm:grid-cols-[1.3fr_1fr]">
              <label className="block">
                <span className="t-small font-medium">Company</span>
                <input autoFocus value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" className="field mt-1.5" />
              </label>
              <label className="block">
                <span className="t-small font-medium">
                  Website <span className="font-normal text-ink-3">optional</span>
                </span>
                <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" inputMode="url" className="field mt-1.5" />
              </label>
              <p className="t-micro text-ink-3 sm:col-span-2">The website pins down which company you mean when several share a name.</p>
            </div>
          )}

          {error && <p className="mt-3 rounded-[10px] bg-risk-soft px-3 py-2 t-small text-risk">{error}</p>}

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button type="submit" className="card group p-4 text-left transition-[box-shadow,transform] duration-150 hover:shadow-[0_0_0_1.5px_var(--accent)] active:scale-[0.99] disabled:opacity-50" disabled={!ready}>
              <span className="flex items-center justify-between">
                <span className="font-semibold">{pending === 'triage' ? 'Starting…' : 'Quick check'}</span>
                <span className="t-micro text-ink-3">about $0.30</span>
              </span>
              <span className="mt-1 block t-small text-ink-2">Red flags in about a minute. Decide whether it is worth more.</span>
            </button>
            <button
              type="button"
              className="card group p-4 text-left transition-[box-shadow,transform] duration-150 hover:shadow-[0_0_0_1.5px_var(--accent)] active:scale-[0.99] disabled:opacity-50"
              disabled={!ready}
              onClick={() => void submit('deep')}
            >
              <span className="flex items-center justify-between">
                <span className="font-semibold">{pending === 'deep' ? 'Starting…' : 'Full research'}</span>
                <span className="t-micro text-ink-3">about $2.10</span>
              </span>
              <span className="mt-1 block t-small text-ink-2">Founders, money, people, AI, outlook, scores and interview prep. 4 to 6 minutes.</span>
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
