import { ownerOr401 } from '../../../../_lib/session'
import { refit } from '../../../../../src/server/refit'

export const dynamic = 'force-dynamic'
// One synthesis call usually takes one to two minutes; leave room within the platform limit.
export const maxDuration = 300

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await refit(owner, (await params).id)
  return Response.json(r.body, { status: r.status })
}
