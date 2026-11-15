import { ownerOr401 } from '../../../_lib/session'
import { importProfile, readUpload } from '../../../../src/profile/import'
import { BudgetExceeded } from '../../../../src/util/cost'

export const dynamic = 'force-dynamic'

/** Reads an uploaded CV (PDF) or pasted text into a profile draft. Returns the draft; saving is a separate step after review. */
export async function POST(req: Request) {
  const owner = await ownerOr401()
  if (owner instanceof Response) return owner
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const text = form?.get('text')
  const upload = await readUpload(file instanceof File ? file : null, typeof text === 'string' ? text : null)
  if (!upload.ok) return Response.json({ error: upload.error }, { status: 400 })
  try {
    return Response.json(await importProfile(owner, upload.input))
  } catch (e) {
    if (e instanceof BudgetExceeded) return Response.json({ error: 'Your research allowance for this month is used up, so the CV could not be read. It resets on the 1st.' }, { status: 402 })
    return Response.json({ error: 'The CV could not be read. Try pasting its text instead.' }, { status: 502 })
  }
}
