// Who is asking. On Supabase: a valid session whose email is on ALLOWED_EMAILS. Without Supabase:
// a fixed local owner, but only off Vercel, so a deployment is never left open by a missing variable.
// AUTH_DISABLED=true is the one deliberate exception: an open deployment, chosen explicitly.

export const LOCAL_OWNER = '00000000-0000-0000-0000-000000000001'

type Env = Partial<Record<string, string>>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** AUTH_DISABLED=true, forgiving of case and stray spaces from pasting into a dashboard. */
export const authDisabled = (env: Env = process.env) => env.AUTH_DISABLED?.trim().toLowerCase() === 'true'

export function authMode(env: Env = process.env): 'supabase' | 'local' | 'open' | 'misconfigured' {
  if (authDisabled(env)) return 'open'
  const supabase = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  if (supabase) return env.ALLOWED_EMAILS?.trim() ? 'supabase' : 'misconfigured'
  return env.VERCEL ? 'misconfigured' : 'local'
}

/** Who owns research while sign-in is off: your Supabase user id, so it is yours once sign-in returns. */
export const openOwner = (env: Env = process.env) => (env.BACKCHANNEL_OWNER && UUID.test(env.BACKCHANNEL_OWNER) ? env.BACKCHANNEL_OWNER : LOCAL_OWNER)

export type Role = 'admin' | 'member'

type Claims = { sub?: string; email?: string; app_metadata?: { backchannel_role?: unknown } }

/**
 * Who a signed-in session is. Admins are the emails in ALLOWED_EMAILS. Members are people an
 * admin invited: the invite tags app_metadata with the secret key, which a user cannot set, so a
 * stranger who signs up anyway is still refused.
 */
export function ownerFromClaims(claims: Claims | null | undefined, adminEmails: string): { id: string; role: Role } | null {
  if (!claims?.sub || !claims.email) return null
  const admins = adminEmails.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (admins.includes(claims.email.toLowerCase())) return { id: claims.sub, role: 'admin' }
  if (claims.app_metadata?.backchannel_role === 'member') return { id: claims.sub, role: 'member' }
  return null
}

/** The admin's own research is limited only by the overall cap; everyone else by their own as well. */
export const isAdminOwner = (owner: string, env: Env = process.env) => owner === openOwner(env)

const SIGN_IN = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'ALLOWED_EMAILS'] as const

/** Environment variable names (never values) this deployment still needs. */
export function missingConfig(env: Env = process.env): string[] {
  const needed = !env.VERCEL ? ['ANTHROPIC_API_KEY'] : authDisabled(env) ? ['DATABASE_URL', 'ANTHROPIC_API_KEY'] : ['DATABASE_URL', ...SIGN_IN, 'ANTHROPIC_API_KEY']
  return needed.filter((k) => !env[k]?.trim())
}

function databaseKind(url = ''): string {
  if (!url) return 'none'
  if (url.startsWith('pglite:')) return 'pglite'
  if (/@db\.[^.]+\.supabase\.co/.test(url)) return 'supabase-direct (unreachable from Vercel: use the transaction pooler)'
  if (/pooler\.supabase\.com/.test(url)) return 'supabase-pooler'
  return 'postgres'
}

/** What a deployment is running with, for diagnosis. Names and kinds only: never a value. */
export function health(env: Env = process.env) {
  return {
    mode: authMode(env),
    missing: missingConfig(env),
    commit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    database: databaseKind(env.DATABASE_URL),
    auth_disabled: env.AUTH_DISABLED ?? null, // a non-secret switch, shown raw so a bad value is visible
    similar_names: Object.keys(env).filter((k) => /AUTH_DIS|BACKCHANNEL/i.test(k)).sort(),
  }
}
