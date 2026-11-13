import { ownerOr401 } from '../../_lib/session'
import { getProfile, saveProfile } from '../../../src/server/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await getProfile(owner)
  return Response.json(r.body, { status: r.status })
}

export async function PUT(req: Request) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await saveProfile(owner, await req.json().catch(() => null))
  return Response.json(r.body, { status: r.status })
}
