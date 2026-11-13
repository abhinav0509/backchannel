import { redirect } from 'next/navigation'
import { authMode, missingConfig } from '../../src/server/auth'

export const dynamic = 'force-dynamic'

// NEXT_PUBLIC_ values are copied into the build. Read literally they show what this build has;
// read by computed name they show what the server has now. Different means: redeploy.
const built = { NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) }

export default function Setup() {
  if (authMode() !== 'misconfigured') redirect('/')
  const missing = missingConfig()
  const stale = (Object.keys(built) as (keyof typeof built)[]).filter((k) => !built[k] && process.env[`${k}`.toString()]?.trim())
  return (
    <section className="max-w-[640px] pt-16">
      <h1 className="t-display">Finish setting up</h1>
      <p className="t-lede mt-3 text-ink-2">Backchannel will not run on a public URL until sign-in and the database are configured.</p>
      {missing.length > 0 && (
        <>
          <p className="mt-8 font-medium">Add these in Vercel, under Project Settings, Environment Variables, for Production:</p>
          <ul className="mt-3 space-y-1.5">
            {missing.map((k) => (
              <li key={k} className="rounded-lg bg-sunken px-3 py-2 t-small font-medium">
                {k}
              </li>
            ))}
          </ul>
        </>
      )}
      {stale.length > 0 && <p className="mt-8 font-medium">{stale.join(' and ')} {stale.length > 1 ? 'are' : 'is'} set, but this build was made before. Redeploy so the browser gets it.</p>}
      <p className="mt-8 t-small text-ink-3">Then redeploy: Deployments, the latest one, Redeploy. Variables only reach a build made after they were added. The README has the full steps.</p>
    </section>
  )
}
