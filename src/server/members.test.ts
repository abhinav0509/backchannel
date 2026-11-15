import { beforeEach, describe, expect, it } from 'vitest'
import { useTestDb } from '../db/db'
import * as repo from '../store/repo'
import { invite, listMembers, removeMember, type AdminAuth } from './members'

const ADMIN = '00000000-0000-0000-0000-000000000001'

function fakeAuth() {
  const users = new Map<string, { id: string; email: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown>; invited_at?: string; last_sign_in_at?: string | null }>()
  users.set(ADMIN, { id: ADMIN, email: 'me@example.com', app_metadata: {}, user_metadata: {} })
  let n = 0
  const calls: string[] = []
  const auth: AdminAuth = {
    async inviteUserByEmail(email, opts) {
      calls.push(`invite ${email} ${opts.redirectTo}`)
      if ([...users.values()].some((u) => u.email === email)) return { data: { user: null }, error: { message: 'A user with this email address has already been registered' } }
      const id = `00000000-0000-0000-0000-0000000001${String(++n).padStart(2, "0")}`
      users.set(id, { id, email, app_metadata: {}, user_metadata: opts.data ?? {}, invited_at: '2026-11-15T00:00:00Z', last_sign_in_at: null })
      return { data: { user: { id } }, error: null }
    },
    async updateUserById(id, attrs) {
      calls.push(`tag ${id}`)
      users.get(id)!.app_metadata = attrs.app_metadata // non-null: tests only tag users they created
      return { error: null }
    },
    async listUsers() {
      return { data: { users: [...users.values()] }, error: null }
    },
    async deleteUser(id) {
      calls.push(`delete ${id}`)
      users.delete(id)
      return { error: null }
    },
  }
  return { auth, users, calls }
}

beforeEach(async () => {
  await useTestDb()
})

describe('members', () => {
  it('invites by email and tags the account as a member, server-side', async () => {
    const f = fakeAuth()
    const r = await invite(f.auth, { email: ' Friend@Example.com ', name: 'Asha' }, 'https://app.example')
    expect(r).toMatchObject({ ok: true })
    const friend = [...f.users.values()].find((u) => u.email === 'friend@example.com')!
    expect(friend.app_metadata).toEqual({ backchannel_role: 'member' })
    expect(friend.user_metadata).toEqual({ name: 'Asha' })
    expect(f.calls[0]).toBe('invite friend@example.com https://app.example/welcome')
  })

  it('says so when that email already has access, and rejects a bad address', async () => {
    const f = fakeAuth()
    expect(await invite(f.auth, { email: 'me@example.com' }, 'https://app.example')).toMatchObject({ ok: false, status: 409 })
    expect(await invite(f.auth, { email: 'not an email' }, 'https://app.example')).toMatchObject({ ok: false, status: 400 })
  })

  it('lists invitees with whether they have signed in and what they spent this month, not the admin', async () => {
    const f = fakeAuth()
    await invite(f.auth, { email: 'a@example.com', name: 'A' }, 'https://app.example')
    const id = [...f.users.values()].find((u) => u.email === 'a@example.com')!.id
    f.users.get(id)!.last_sign_in_at = '2026-11-15T10:00:00Z'
    const db = await useTestDb()
    await db.query("insert into spend (owner_id, stage, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, searches, usd) values ($1, 'money', 'm', 0, 0, 0, 0, 0, 1.25)", [id])
    const list = await listMembers(f.auth)
    expect(list).toEqual([{ id, email: 'a@example.com', name: 'A', status: 'active', invited_at: '2026-11-15T00:00:00Z', spent_usd: 1.25 }])
  })

  it('removing someone deletes their account and their research, and never the admin', async () => {
    const f = fakeAuth()
    await invite(f.auth, { email: 'a@example.com' }, 'https://app.example')
    const id = [...f.users.values()].find((u) => u.email === 'a@example.com')!.id
    await repo.createOpportunity(id, 'theirs')
    const mine = await repo.createOpportunity(ADMIN, 'mine')
    expect(await removeMember(f.auth, id)).toMatchObject({ ok: true })
    expect(await repo.listOpportunities(id)).toEqual([])
    expect(await repo.getOpportunity(ADMIN, mine.id)).not.toBeNull()
    expect(await removeMember(f.auth, ADMIN)).toMatchObject({ ok: false, status: 400 })
  })
})
