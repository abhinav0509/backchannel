import { get } from '../../../../src/server/api.js'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = get((await params).id)
  return Response.json(r.body, { status: r.status })
}
