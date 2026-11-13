import { notFound } from 'next/navigation'
import { requireOwner } from '../../_lib/session'
import { get } from '../../../src/server/api'
import { authMode } from '../../../src/server/auth'
import type { Opportunity } from '../../../src/store/repo'
import { OpportunityView } from '../../_ui/OpportunityView'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const r = await get(await requireOwner(), (await params).id)
  if (r.status !== 200) notFound()
  // Realtime delivers rows only to a signed-in user (RLS); without sign-in the page polls instead.
  return <OpportunityView initial={r.body as Opportunity} realtime={authMode() === 'supabase'} />
}
