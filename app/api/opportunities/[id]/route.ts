import { ownerOr401 } from '../../../_lib/session'
import { get } from '../../../../src/server/api'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await get(owner, (await params).id)
  return Response.json(r.body, { status: r.status })
}
