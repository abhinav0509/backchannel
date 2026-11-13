import { run } from '../../../../../src/server/api.js'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await run((await params).id, await req.json().catch(() => null))
  return Response.json(r.body, { status: r.status })
}
