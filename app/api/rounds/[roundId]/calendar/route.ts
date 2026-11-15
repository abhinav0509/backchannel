import { ownerOr401 } from '../../../../_lib/session'
import { roundCalendar } from '../../../../../src/server/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await roundCalendar(owner, (await params).roundId, new URL(req.url).origin)
  if (r.status !== 200) return Response.json(r.body, { status: r.status })
  return new Response(String(r.body), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="${r.filename}"` } })
}
