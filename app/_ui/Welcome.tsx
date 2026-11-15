'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import type { Profile } from '../../src/types/profile'
import { ProfileForm } from './ProfileForm'
import { TaskProgress } from './TaskProgress'

type Step = { at: 'upload' } | { at: 'reading' } | { at: 'review'; draft: Profile }

const WHAT = [
  ['Research any company', 'Paste what a recruiter sent, or name a company. Who owns it, who runs it, its money, layoffs, AI and press, each fact with its source.'],
  ['See how you fit', 'Your CV becomes your profile. Every report then scores role fit and career signal against it, and names your strengths, gaps and what to bring up.'],
  ['Walk in prepared', 'Questions to ask in each round, the people tied to the role, and a place for your notes and next steps.'],
] as const

/**
 * First run for someone you invited: what Backchannel does, then their CV becomes their profile.
 * The CV is read once and not kept; they review everything before it is saved.
 */
export function Welcome({ name, updating, allowance }: { name: string | null; updating: boolean; allowance: string | null }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>({ at: 'upload' })
  const [text, setText] = useState('')
  const [paste, setPaste] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function read(file: File | null, pasted?: string) {
    setError(null)
    setStep({ at: 'reading' })
    const form = new FormData()
    if (file) form.set('file', file)
    if (pasted) form.set('text', pasted)
    const res = await fetch('/api/profile/import', { method: 'POST', body: form }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as (Profile & { error?: string }) | null
    if (!res?.ok || !body || body.error) {
      setError(body?.error ?? 'The CV could not be read. Try pasting its text instead.')
      setStep({ at: 'upload' })
      return
    }
    setStep({ at: 'review', draft: body })
  }

  if (step.at === 'review')
    return (
      <div className="fill-in">
        <ProfileForm
          initial={step.draft}
          title="Check what we read"
          intro="This came from your CV. Fix anything that is off, add the levels you are aiming for and anything you will not compromise on, then save."
          onSaved={() => {
            router.push('/')
            router.refresh()
          }}
        />
      </div>
    )

  return (
    <div className="mx-auto max-w-[720px] pt-10 lg:pt-16">
      {!updating && (
        <>
          <h1 className="t-hero">{name ? `Welcome, ${name.split(' ')[0]}.` : 'Welcome to Backchannel.'}</h1>
          <p className="mt-4 max-w-[52ch] t-lede text-ink-2">Know the company before the first call, and how you fit before the second.</p>
          <ol className="mt-10 grid gap-3 sm:grid-cols-3">
            {WHAT.map(([title, body]) => (
              <li key={title} className="card p-4">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 t-small text-ink-2">{body}</p>
              </li>
            ))}
          </ol>
        </>
      )}

      <section aria-labelledby="cv" className={updating ? '' : 'mt-12'}>
        <h2 id="cv" className={updating ? 't-display' : 't-title'}>
          {updating ? 'Update your profile from a CV' : 'Start with your CV'}
        </h2>
        <p className="mt-1 t-small text-ink-3">It takes a few seconds. Your CV is read once to fill in your profile, then discarded; you review everything before it is saved.</p>

        {step.at === 'reading' ? (
          <div className="mt-5">
            <TaskProgress
              title="Reading your CV"
              steps={['Reading the document', 'Counting your years across roles', 'Picking out skills and domains', 'Drafting your profile']}
              expectedSeconds={8}
              note="Usually a few seconds. Nothing is saved until you review it."
              preview={
                <div className="space-y-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:gap-6">
                      <span className="skeleton block h-3 w-24" />
                      <span className="skeleton block h-9 w-full rounded-[10px]" />
                    </div>
                  ))}
                </div>
              }
            />
          </div>
        ) : paste ? (
          <div className="fill-in mt-5">
            <label htmlFor="cv-text" className="sr-only">
              Your CV as text
            </label>
            <textarea id="cv-text" autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste your CV, or your LinkedIn About and Experience sections" className="field field-sizing-content max-h-[50vh] min-h-[220px] resize-none" />
            <div className="mt-3 flex items-center justify-between">
              <button type="button" className="t-small font-medium text-accent hover:underline" onClick={() => setPaste(false)}>
                Upload a PDF instead
              </button>
              <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => void read(null, text)}>
                Read it
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                void read(e.dataTransfer.files[0] ?? null)
              }}
              className={`card flex w-full flex-col items-center gap-2 px-6 py-12 text-center transition-[box-shadow,background-color] duration-150 ${drag ? 'bg-accent-soft shadow-[0_0_0_2px_var(--accent)]' : 'hover:shadow-[0_0_0_1.5px_var(--accent)]'}`}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden className="text-accent">
                <path d="M8 3.5h8l6 6V23a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 7 23V5A1.5 1.5 0 0 1 8.5 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M16 3.5V10h6M14 20v-6.5m-2.75 2.75L14 13.5l2.75 2.75" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-semibold">Drop your CV here, or choose a file</span>
              <span className="t-small text-ink-3">PDF, up to 4 MB</span>
            </button>
            <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => void read(e.target.files?.[0] ?? null)} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <button type="button" className="t-small font-medium text-accent hover:underline" onClick={() => setPaste(true)}>
                No PDF? Paste the text
              </button>
              {!updating && (
                <Link href="/?skip" className="t-small text-ink-3 hover:text-ink-2">
                  Skip for now
                </Link>
              )}
            </div>
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-[10px] bg-risk-soft px-3 py-2 t-small text-risk" role="alert">
            {error}
          </p>
        )}
      </section>

      {allowance && !updating && <p className="mt-12 t-micro text-ink-3">{allowance}</p>}
    </div>
  )
}
