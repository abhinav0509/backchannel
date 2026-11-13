// Who is asking. On Supabase: a valid session whose email is on ALLOWED_EMAILS. Without Supabase:
// a fixed local owner, but only off Vercel, so a deployment is never left open by a missing variable.

export const LOCAL_OWNER = '00000000-0000-0000-0000-000000000001'

type Env = Partial<Record<string, string>>

export function authMode(env: Env = process.env): 'supabase' | 'local' | 'misconfigured' {
  const supabase = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  if (supabase) return env.ALLOWED_EMAILS?.trim() ? 'supabase' : 'misconfigured'
  return env.VERCEL ? 'misconfigured' : 'local'
}

export function ownerFromClaims(claims: { sub?: string; email?: string } | null | undefined, allowedEmails: string): string | null {
  if (!claims?.sub || !claims.email) return null
  const allowed = allowedEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(claims.email.toLowerCase()) ? claims.sub : null
}
