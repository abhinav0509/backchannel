import { redirect } from 'next/navigation'
import { demoShareId } from '../../src/store/repo'

export const dynamic = 'force-dynamic'

/** The public demo: the admin's most recently shared report. */
export async function GET() {
  const id = await demoShareId()
  redirect(id ? `/r/${id}` : '/login')
}
