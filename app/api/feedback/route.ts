import { z } from 'zod'
import { adminOr403, ownerOr401 } from '../../_lib/session'
import { adminAuth, listMembers } from '../../../src/server/members'
import { addFeedback, listFeedback } from '../../../src/store/feedback'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  try {
    await addFeedback(owner, await req.json().catch(() => null))
    return Response.json({ ok: true }, { status: 201 })
  } catch (e) {
    const error = e instanceof z.ZodError ? 'Write something first, up to 2,000 characters.' : e instanceof Error && /a day/.test(e.message) ? 'That is 20 notes today. Thank you; send more tomorrow.' : null
    if (error) return Response.json({ error }, { status: 400 })
    throw e
  }
}

/** Everyone's feedback with who sent it, for the admin. */
export async function GET() {
  const admin = await adminOr403()
  if (admin instanceof Response) return admin
  const auth = adminAuth()
  const people = auth ? await listMembers(auth).catch(() => []) : []
  const who = new Map(people.map((m) => [m.id, m.name ?? m.email]))
  const rows = await listFeedback()
  return Response.json(rows.map((f) => ({ ...f, from: f.owner_id === admin ? 'You' : (who.get(f.owner_id) ?? 'Someone you removed') })))
}
