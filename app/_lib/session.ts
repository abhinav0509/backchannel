import { redirect } from 'next/navigation'
import { authMode, LOCAL_OWNER, missingConfig, openOwner, ownerFromClaims } from '../../src/server/auth'
import { supabaseServer } from './supabase'

/** The signed-in owner's id, or null. Throws when the deployment is missing its auth configuration. */
export async function currentOwner(): Promise<string | null> {
  const mode = authMode()
  if (mode === 'local') return LOCAL_OWNER
  if (mode === 'open') return openOwner()
  if (mode === 'misconfigured') throw new Error('Auth is not configured: set the Supabase variables and ALLOWED_EMAILS.')
  const { data } = await (await supabaseServer()).auth.getClaims()
  return ownerFromClaims(data?.claims as { sub?: string; email?: string } | undefined, process.env.ALLOWED_EMAILS ?? '')
}

/** For pages: the owner, or a redirect to sign in. */
export async function requireOwner(): Promise<string> {
  if (authMode() === 'misconfigured') redirect('/setup')
  const owner = await currentOwner()
  if (!owner) redirect('/login')
  return owner
}

/** For route handlers: the owner, or a 401 response to return. */
export async function ownerOr401(): Promise<string | Response> {
  if (authMode() === 'misconfigured') return Response.json({ error: `Not configured. Missing: ${missingConfig().join(', ')}` }, { status: 503 })
  return (await currentOwner()) ?? Response.json({ error: 'Sign in to continue.' }, { status: 401 })
}
