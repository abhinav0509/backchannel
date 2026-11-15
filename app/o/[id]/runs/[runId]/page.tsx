import { notFound } from 'next/navigation'
import { requireOwner } from '../../../../_lib/session'
import { runTrace } from '../../../../../src/store/repo'
import { RunInspector } from '../../../../_ui/RunInspector'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const owner = await requireOwner()
  const { id, runId } = await params
  const trace = await runTrace(owner, id, runId)
  if (!trace) notFound()
  return <RunInspector trace={trace} back={{ href: `/o/${id}?tab=sources`, label: 'Report' }} />
}
