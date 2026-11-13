'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

export function Intake() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [pending, setPending] = useState<'triage' | 'deep' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const ready = text.trim().length > 0 && !pending

  async function submit(mode: 'triage' | 'deep') {
    if (!text.trim() || pending) return
    setPending(mode)
    setError(null)
    const res = await fetch('/api/opportunities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, mode }) })
    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
    if (!res.ok || !body.id) {
      setPending(null)
      setError(body.error ?? 'Could not start the research. Check that the dev server is running.')
      return
    }
    router.push(`/o/${body.id}`)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit('triage')
      }}
      className="rounded-[22px] border border-line bg-surface transition-[border-color,box-shadow] duration-200 focus-within:border-accent/60 focus-within:shadow-[0_0_0_4px_var(--accent-soft)]"
    >
      <label htmlFor="intake" className="sr-only">
        Recruiter email or job description
      </label>
      <textarea
        id="intake"
        ref={area}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            void submit(e.shiftKey ? 'deep' : 'triage')
          }
        }}
        placeholder="Paste a recruiter email or job description"
        rows={5}
        className="field-sizing-content block max-h-[50vh] min-h-[132px] w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[17px] leading-[1.47] text-ink outline-none placeholder:text-ink-3"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-1 pb-3 pl-5">
        <p className="t-micro text-ink-3" aria-live="polite">
          {error ? <span className="text-risk">{error}</span> : 'Quick check takes about a minute and costs around $0.20. Full research takes 2 to 4 minutes, around $1.30.'}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn btn-quiet" disabled={!ready} onClick={() => void submit('deep')}>
            {pending === 'deep' ? 'Starting…' : 'Full research'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!ready}>
            {pending === 'triage' ? 'Starting…' : 'Quick check'}
          </button>
        </div>
      </div>
    </form>
  )
}
