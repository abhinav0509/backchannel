import { ownerOr401 } from '../../../../_lib/session'
import { share } from '../../../../../src/server/api'

export const dynamic = 'force-dynamic'

async function handle(params: Promise<{ id: string }>, on: boolean) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await share(owner, (await params).id, on)
  return Response.json(r.body, { status: r.status })
}

export const POST = (_req: Request, { params }: { params: Promise<{ id: string }> }) => handle(params, true)
export const DELETE = (_req: Request, { params }: { params: Promise<{ id: string }> }) => handle(params, false)
