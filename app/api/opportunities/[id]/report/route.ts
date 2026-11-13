import { ownerOr401 } from '../../../../_lib/session'
import { markdown } from '../../../../../src/server/api'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const r = await markdown(owner, (await params).id)
  return new Response(String(r.body), {
    status: r.status,
    headers: { 'content-type': 'text/markdown; charset=utf-8', ...(r.filename && { 'content-disposition': `attachment; filename="${r.filename}"` }) },
  })
}
