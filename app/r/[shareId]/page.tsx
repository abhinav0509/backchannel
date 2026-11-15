import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getShared } from '../../../src/store/repo'
import { SharedReport } from '../../_ui/SharedReport'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
  const s = await getShared((await params).shareId)
  return { title: s ? `${s.report.identity.display_name}, a Backchannel report` : 'Backchannel', robots: { index: false } }
}

export default async function Page({ params }: { params: Promise<{ shareId: string }> }) {
  const s = await getShared((await params).shareId)
  if (!s) notFound()
  return <SharedReport s={s} />
}
