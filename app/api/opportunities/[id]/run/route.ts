import { ownerOr401 } from '../../../../_lib/session'
import { run } from '../../../../../src/server/api'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await run(owner, (await params).id, await req.json().catch(() => null))
  return Response.json(r.body, { status: r.status })
}
