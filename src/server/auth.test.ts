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
