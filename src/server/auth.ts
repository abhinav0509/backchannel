// Who is asking. On Supabase: a valid session whose email is on ALLOWED_EMAILS. Without Supabase:
// a fixed local owner, but only off Vercel, so a deployment is never left open by a missing variable.
// AUTH_DISABLED=true is the one deliberate exception: an open deployment, chosen explicitly.

export const LOCAL_OWNER = '00000000-0000-0000-0000-000000000001'

type Env = Partial<Record<string, string>>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function authMode(env: Env = process.env): 'supabase' | 'local' | 'open' | 'misconfigured' {
  if (env.AUTH_DISABLED === 'true') return 'open'
  const supabase = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  if (supabase) return env.ALLOWED_EMAILS?.trim() ? 'supabase' : 'misconfigured'
  return env.VERCEL ? 'misconfigured' : 'local'
}

/** Who owns research while sign-in is off: your Supabase user id, so it is yours once sign-in returns. */
export const openOwner = (env: Env = process.env) => (env.BACKCHANNEL_OWNER && UUID.test(env.BACKCHANNEL_OWNER) ? env.BACKCHANNEL_OWNER : LOCAL_OWNER)

export function ownerFromClaims(claims: { sub?: string; email?: string } | null | undefined, allowedEmails: string): string | null {
  if (!claims?.sub || !claims.email) return null
  const allowed = allowedEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(claims.email.toLowerCase()) ? claims.sub : null
}

const SIGN_IN = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'ALLOWED_EMAILS'] as const

/** Environment variable names (never values) this deployment still needs. */
export function missingConfig(env: Env = process.env): string[] {
  const needed = !env.VERCEL ? ['ANTHROPIC_API_KEY'] : env.AUTH_DISABLED === 'true' ? ['DATABASE_URL', 'ANTHROPIC_API_KEY'] : ['DATABASE_URL', ...SIGN_IN, 'ANTHROPIC_API_KEY']
  return needed.filter((k) => !env[k]?.trim())
}
