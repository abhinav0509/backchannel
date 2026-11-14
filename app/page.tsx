import { list, type Summary } from '../src/server/api'
import { PIPELINE, type Pipeline } from '../src/types/pipeline'
import { requireOwner } from './_lib/session'
import { AutoRefresh } from './_ui/AutoRefresh'
import { Inbox } from './_ui/Inbox'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ stage?: string; view?: string }> }) {
  const items = (await list(await requireOwner())).body as Summary[]
  const q = await searchParams
  const stage = (PIPELINE as readonly string[]).includes(q.stage ?? '') ? (q.stage as Pipeline) : null
  return (
    <>
      <AutoRefresh active={items.some((o) => o.status === 'running')} />
      <Inbox items={items} stage={stage} view={q.view === 'board' ? 'board' : 'list'} today={new Date().toISOString().slice(0, 10)} />
    </>
  )
}
