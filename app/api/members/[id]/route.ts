import { adminOr403 } from '../../../_lib/session'
import { adminAuth, removeMember } from '../../../../src/server/members'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminOr403()
  if (admin instanceof Response) return admin
  const auth = adminAuth()
  if (!auth) return Response.json({ error: 'Invitations need SUPABASE_SECRET_KEY in the Vercel environment.' }, { status: 503 })
  const r = await removeMember(auth, (await params).id)
  return r.ok ? new Response(null, { status: 204 }) : Response.json({ error: r.error }, { status: r.status })
}
