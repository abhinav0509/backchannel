import { redirect } from 'next/navigation'
import { getProfile, inbox } from '../src/server/api'
import { PIPELINE, type Pipeline } from '../src/types/pipeline'
import { requireOwner } from './_lib/session'
import { AutoRefresh } from './_ui/AutoRefresh'
import { Inbox } from './_ui/Inbox'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ stage?: string; view?: string; skip?: string }> }) {
  const owner = await requireOwner()
  const [{ items, agenda }, profile] = await Promise.all([inbox(owner), getProfile(owner)])
  // Someone brand new starts with their CV, not an empty inbox. Skipping it leaves research for later.
  const q = await searchParams
  if (!items.length && profile.body === null && q.skip === undefined) redirect('/welcome')
  const stage = (PIPELINE as readonly string[]).includes(q.stage ?? '') ? (q.stage as Pipeline) : null
  return (
    <>
      <AutoRefresh active={items.some((o) => o.status === 'running')} />
      <Inbox items={items} agenda={agenda} stage={stage} view={q.view === 'board' ? 'board' : 'list'} today={new Date().toISOString().slice(0, 10)} />
    </>
  )
}
