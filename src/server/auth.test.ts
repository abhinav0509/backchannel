import { describe, expect, it } from 'vitest'
import { authMode, LOCAL_OWNER, ownerFromClaims } from './auth'

describe('authMode', () => {
  it('uses Supabase when its URL and key are set', () =>
    expect(authMode({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k', ALLOWED_EMAILS: 'a@b.co' })).toBe('supabase'))
  it('runs as a fixed local owner on your machine without Supabase', () => expect(authMode({})).toBe('local'))
  it('refuses to run unprotected on Vercel', () => expect(authMode({ VERCEL: '1' })).toBe('misconfigured'))
  it('refuses Supabase without an allowlist, so a stranger with an account cannot get in', () =>
    expect(authMode({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBe('misconfigured'))
})

describe('ownerFromClaims', () => {
  const allowed = 'Me@Example.com, other@example.com'
  it('accepts an allowed email, case-insensitively, and returns the user id', () =>
    expect(ownerFromClaims({ sub: 'u-1', email: 'me@example.COM' }, allowed)).toBe('u-1'))
  it('rejects anyone else, and a session without claims', () => {
    expect(ownerFromClaims({ sub: 'u-2', email: 'stranger@example.com' }, allowed)).toBeNull()
    expect(ownerFromClaims(null, allowed)).toBeNull()
    expect(ownerFromClaims({ sub: 'u-3' }, allowed)).toBeNull()
  })
  it('the local owner is a fixed uuid', () => expect(LOCAL_OWNER).toMatch(/^[0-9a-f-]{36}$/))
})

describe('missingConfig', () => {
  it('names the variables a deployment still needs, never their values', async () => {
    const { missingConfig } = await import('./auth')
    expect(missingConfig({ VERCEL: '1' })).toEqual(['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'ALLOWED_EMAILS', 'ANTHROPIC_API_KEY'])
    expect(missingConfig({ VERCEL: '1', DATABASE_URL: 'postgres://x', NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k', ALLOWED_EMAILS: 'a@b.co', ANTHROPIC_API_KEY: 'k' })).toEqual([])
  })
  it('requires nothing locally except the API key', async () => {
    const { missingConfig } = await import('./auth')
    expect(missingConfig({})).toEqual(['ANTHROPIC_API_KEY'])
  })
})

describe('AUTH_DISABLED (temporary open mode)', () => {
  const hosted = { VERCEL: '1', DATABASE_URL: 'postgres://x', ANTHROPIC_API_KEY: 'k' }
  it('runs without sign-in when explicitly switched off, even on Vercel', () => {
    expect(authMode({ ...hosted, AUTH_DISABLED: 'true' })).toBe('open')
    expect(authMode({ ...hosted, AUTH_DISABLED: 'true', NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBe('open')
  })
  it('accepts true in any case and with stray spaces, and nothing else', () => {
    expect(authMode({ ...hosted, AUTH_DISABLED: ' TRUE ' })).toBe('open')
    expect(authMode({ ...hosted, AUTH_DISABLED: 'yes' })).toBe('misconfigured')
    expect(authMode({ ...hosted, AUTH_DISABLED: 'false' })).toBe('misconfigured')
  })
  it('open mode still needs the database and API key, but not the sign-in variables', async () => {
    const { missingConfig } = await import('./auth')
    expect(missingConfig({ VERCEL: '1', AUTH_DISABLED: 'true' })).toEqual(['DATABASE_URL', 'ANTHROPIC_API_KEY'])
    expect(missingConfig({ ...hosted, AUTH_DISABLED: 'true' })).toEqual([])
  })
  it('in open mode research belongs to BACKCHANNEL_OWNER, so it is yours when sign-in returns', async () => {
    const { openOwner, LOCAL_OWNER } = await import('./auth')
    expect(openOwner({ BACKCHANNEL_OWNER: '719a2c31-2a0a-406d-befb-ae930cc55978' })).toBe('719a2c31-2a0a-406d-befb-ae930cc55978')
    expect(openOwner({})).toBe(LOCAL_OWNER)
    expect(openOwner({ BACKCHANNEL_OWNER: 'not-a-uuid' })).toBe(LOCAL_OWNER)
  })
})

describe('health', () => {
  it('reports mode, missing variable names and the deployed commit, never values', async () => {
    const { health } = await import('./auth')
    const h = health({ VERCEL: '1', AUTH_DISABLED: 'true', DATABASE_URL: 'postgres://user:SECRET@host/db', VERCEL_GIT_COMMIT_SHA: 'abc1234def' })
    expect(h).toEqual({ mode: 'open', missing: ['ANTHROPIC_API_KEY'], commit: 'abc1234', database: 'postgres' })
    expect(JSON.stringify(h)).not.toContain('SECRET')
  })
  it('names the database kind so a direct (IPv6-only) Supabase host is caught', async () => {
    const { health } = await import('./auth')
    expect(health({ DATABASE_URL: 'postgresql://postgres:x@db.abc.supabase.co:5432/postgres' }).database).toBe('supabase-direct (unreachable from Vercel: use the transaction pooler)')
    expect(health({ DATABASE_URL: 'postgresql://postgres.abc:x@aws-0-ap-south-1.pooler.supabase.com:6543/postgres' }).database).toBe('supabase-pooler')
  })
})
