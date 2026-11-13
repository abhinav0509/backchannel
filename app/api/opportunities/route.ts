import { create, list } from '../../../src/server/api.js'

export const dynamic = 'force-dynamic'

export function GET() {
  const r = list()
  return Response.json(r.body, { status: r.status })
}

export async function POST(req: Request) {
  const r = await create(await req.json().catch(() => null))
  return Response.json(r.body, { status: r.status })
}
