import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { sharedTrace } from '../../../../src/store/repo'
import { RunInspector } from '../../../_ui/RunInspector'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'How this research ran, Backchannel', robots: { index: false } }

export default async function Page({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params
  const trace = await sharedTrace(shareId)
  if (!trace) notFound()
  return <RunInspector trace={trace} back={{ href: `/r/${shareId}`, label: 'Report' }} />
}
