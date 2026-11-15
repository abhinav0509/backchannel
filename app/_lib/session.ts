import { redirect } from 'next/navigation'
import { authMode, LOCAL_OWNER, missingConfig, openOwner, ownerFromClaims, type Role } from '../../src/server/auth'
import { supabaseServer } from './supabase'

/** The signed-in user and their role, or null. Throws when the deployment is missing its auth configuration. */
export async function currentUser(): Promise<{ id: string; role: Role } | null> {
  const mode = authMode()
  if (mode === 'local') return { id: LOCAL_OWNER, role: 'admin' }
  if (mode === 'open') return { id: openOwner(), role: 'admin' }
  if (mode === 'misconfigured') throw new Error('Auth is not configured: set the Supabase variables and ALLOWED_EMAILS.')
  const { data } = await (await supabaseServer()).auth.getClaims()
  return ownerFromClaims(data?.claims as Parameters<typeof ownerFromClaims>[0], process.env.ALLOWED_EMAILS ?? '')
}

/** The signed-in owner's id, or null. */
export const currentOwner = async (): Promise<string | null> => (await currentUser())?.id ?? null

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

/** For admin-only route handlers: the admin's id, or the response to return. */
export async function adminOr403(): Promise<string | Response> {
  if (authMode() === 'misconfigured') return Response.json({ error: `Not configured. Missing: ${missingConfig().join(', ')}` }, { status: 503 })
  const user = await currentUser()
  if (!user) return Response.json({ error: 'Sign in to continue.' }, { status: 401 })
  return user.role === 'admin' ? user.id : Response.json({ error: 'Only the admin can do that.' }, { status: 403 })
}
