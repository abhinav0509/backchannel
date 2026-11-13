import { ownerOr401 } from '../../_lib/session'
import { create, list } from '../../../src/server/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await list(owner)
  return Response.json(r.body, { status: r.status })
}

export async function POST(req: Request) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await create(owner, await req.json().catch(() => null))
  return Response.json(r.body, { status: r.status })
}
