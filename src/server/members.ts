import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getDb } from '../db/db'
import { isAdminOwner } from './auth'

type Err = { message: string } | null

/** The slice of the Supabase admin API this app uses, so tests can stand in for it. */
export interface AdminAuth {
  inviteUserByEmail(email: string, opts: { redirectTo: string; data?: Record<string, unknown> }): Promise<{ data: { user: { id: string } | null }; error: Err }>
  updateUserById(id: string, attrs: { app_metadata: Record<string, unknown> }): Promise<{ error: Err }>
  listUsers(params?: { page?: number; perPage?: number }): Promise<{
    data: { users: { id: string; email?: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown>; invited_at?: string; last_sign_in_at?: string | null }[] }
    error: Err
  }>
  deleteUser(id: string): Promise<{ error: Err }>
}

/** The admin API, with the secret key that only the server holds. null when it is not configured. */
export function adminAuth(env = process.env): AdminAuth | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin as unknown as AdminAuth
}

type Result = { ok: true } | { ok: false; status: number; error: string }

const Invite = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()), name: z.string().trim().max(80).optional() })

/**
 * Sends an invitation email and tags the new account as a member. The tag lives in app_metadata,
 * which only the secret key can write, so it is what lets them in (see ownerFromClaims).
 */
export async function invite(auth: AdminAuth, body: unknown, origin: string): Promise<Result> {
  const b = Invite.safeParse(body)
  if (!b.success) return { ok: false, status: 400, error: 'Enter a valid email address.' }
  const { data, error } = await auth.inviteUserByEmail(b.data.email, { redirectTo: `${origin}/welcome`, ...(b.data.name && { data: { name: b.data.name } }) })
  if (error || !data.user) {
    const taken = /already been registered|already exists/i.test(error?.message ?? '')
    return { ok: false, status: taken ? 409 : 502, error: taken ? 'That email already has access.' : `The invitation could not be sent: ${error?.message ?? 'no user returned'}` }
  }
  const tagged = await auth.updateUserById(data.user.id, { app_metadata: { backchannel_role: 'member' } })
  if (tagged.error) return { ok: false, status: 502, error: `Invited, but access was not granted: ${tagged.error.message}. Remove and invite again.` }
  return { ok: true }
}

export interface Member {
  id: string
  email: string
  name: string | null
  status: 'invited' | 'active'
  invited_at: string | null
  spent_usd: number
}

/** Everyone you invited, whether they have signed in yet, and what their research cost this month. */
export async function listMembers(auth: AdminAuth): Promise<Member[]> {
  const { data, error } = await auth.listUsers({ page: 1, perPage: 200 })
  if (error) throw new Error(error.message)
  const members = data.users.filter((u) => u.app_metadata.backchannel_role === 'member' && !isAdminOwner(u.id))
  const rows = await (await getDb()).query<{ owner_id: string; usd: number }>(
    "select owner_id, coalesce(sum(usd), 0)::float8 as usd from spend where at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc' and owner_id is not null group by owner_id",
  )
  const spent = new Map(rows.map((r) => [r.owner_id, r.usd]))
  return members.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    name: typeof u.user_metadata.name === 'string' ? u.user_metadata.name : null,
    status: u.last_sign_in_at ? 'active' : 'invited',
    invited_at: u.invited_at ?? null,
    spent_usd: spent.get(u.id) ?? 0,
  }))
}

/** Takes away someone's access and deletes what they researched. Their past spend stays on the month's total. */
export async function removeMember(auth: AdminAuth, id: string): Promise<Result> {
  if (isAdminOwner(id)) return { ok: false, status: 400, error: 'You cannot remove yourself.' }
  const { error } = await auth.deleteUser(id)
  if (error) return { ok: false, status: 502, error: error.message }
  const db = await getDb()
  await db.query('delete from opportunities where owner_id = $1', [id])
  await db.query('delete from profiles where owner_id = $1', [id])
  return { ok: true }
}
