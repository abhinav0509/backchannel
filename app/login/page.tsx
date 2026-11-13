'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { supabaseBrowser } from '../_lib/supabase-browser'

/** Sign in with a one-time code sent by email. A code (not a link) works when the email is opened on another device. */
export default function Login() {
  // useSearchParams needs a Suspense boundary so the page can still be prerendered.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const linkExpired = useSearchParams().get('link') === 'expired'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = supabaseBrowser()

  if (!supabase) return <p className="pt-20 t-small text-ink-2">Sign-in is not configured. Running locally, there is nothing to sign in to.</p>

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    // shouldCreateUser false: only an account that already exists in Supabase can sign in.
    const { error } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setBusy(false)
    if (error) setError('Could not send a code to that address. Check it is the email this app was set up for.')
    else setSent(true)
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) return setError('That code did not work. Codes expire after an hour; request a new one if needed.')
    router.replace('/')
    router.refresh()
  }

  const field =
    'mt-1.5 block h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[17px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent/60 focus:shadow-[0_0_0_4px_var(--accent-soft)]'

  return (
    <section className="mx-auto max-w-sm pt-24">
      <h1 className="t-title">Sign in to Backchannel</h1>
      {linkExpired && !sent && (
        <p className="mt-3 t-small text-ink-2" role="status">
          That sign-in link had expired or was opened in a different browser. Request a new one below and open it on this device.
        </p>
      )}
      {!sent ? (
        <form onSubmit={sendCode} className="mt-6">
          <label htmlFor="email" className="t-small text-ink-2">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          <button className="btn btn-primary mt-5 w-full justify-center" disabled={busy || !email}>
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6">
          <p className="t-small text-ink-2">Check {email}. Open the sign-in link on this device and in this browser. If your email shows a code instead, type it here.</p>
          <label htmlFor="code" className="mt-5 block t-small text-ink-2">
            Code
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className={`${field} tracking-[0.3em] tabular-nums`}
          />
          <button className="btn btn-primary mt-5 w-full justify-center" disabled={busy || code.length < 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="mt-3 t-small text-accent hover:underline" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </form>
      )}
      {error && (
        <p className="mt-4 t-small text-risk" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
