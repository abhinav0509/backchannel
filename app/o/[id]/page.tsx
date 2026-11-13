import { notFound } from 'next/navigation'
import { get } from '../../../src/server/api'
import type { Opportunity } from '../../../src/store/store'
import { OpportunityView } from '../../_ui/OpportunityView'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const r = get((await params).id)
  if (r.status !== 200) notFound()
  return <OpportunityView initial={r.body as Opportunity} />
}
