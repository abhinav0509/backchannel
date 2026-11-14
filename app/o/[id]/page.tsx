import { notFound } from 'next/navigation'
import { requireOwner } from '../../_lib/session'
import { get } from '../../../src/server/api'
import { authMode } from '../../../src/server/auth'
import type { Opportunity } from '../../../src/store/repo'
import { TABS, type Tab } from '../../_lib/tabs'
import { OpportunityView } from '../../_ui/OpportunityView'

export const dynamic = 'force-dynamic'

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const r = await get(await requireOwner(), (await params).id)
  if (r.status !== 200) notFound()
  const tab = (await searchParams).tab
  // Realtime delivers rows only to a signed-in user (RLS); without sign-in the page polls instead.
  return <OpportunityView initial={r.body as Opportunity} realtime={authMode() === 'supabase'} tab={(TABS as readonly string[]).includes(tab ?? '') ? (tab as Tab) : null} />
}
