import { adminOr403 } from '../../_lib/session'
import { adminAuth, invite, listMembers } from '../../../src/server/members'

export const dynamic = 'force-dynamic'

const notConfigured = () => Response.json({ error: 'Invitations need SUPABASE_SECRET_KEY in the Vercel environment.' }, { status: 503 })

export async function GET() {
  const admin = await adminOr403()
  if (admin instanceof Response) return admin
  const auth = adminAuth()
  return auth ? Response.json(await listMembers(auth)) : notConfigured()
}

export async function POST(req: Request) {
  const admin = await adminOr403()
  if (admin instanceof Response) return admin
  const auth = adminAuth()
  if (!auth) return notConfigured()
  const r = await invite(auth, await req.json().catch(() => null), new URL(req.url).origin)
  return r.ok ? Response.json({ ok: true }, { status: 201 }) : Response.json({ error: r.error }, { status: r.status })
}
