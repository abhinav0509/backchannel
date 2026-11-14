import { ownerOr401 } from '../../../_lib/session'
import { get, remove, track } from '../../../../src/server/api'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await get(owner, (await params).id)
  return Response.json(r.body, { status: r.status })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await track(owner, (await params).id, await req.json().catch(() => null))
  return Response.json(r.body, { status: r.status })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await remove(owner, (await params).id)
  return r.status === 204 ? new Response(null, { status: 204 }) : Response.json(r.body, { status: r.status })
}
