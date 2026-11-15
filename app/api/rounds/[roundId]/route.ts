import { ownerOr401 } from '../../../_lib/session'
import { patchRound, removeRound } from '../../../../src/server/api'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await patchRound(owner, (await params).roundId, await req.json().catch(() => null))
  return Response.json(r.body, { status: r.status })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await removeRound(owner, (await params).roundId)
  return r.status === 204 ? new Response(null, { status: 204 }) : Response.json(r.body, { status: r.status })
}
