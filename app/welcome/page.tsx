import { authMode } from '../../src/server/auth'
import { allowance } from '../../src/util/cost'
import { requireOwner } from '../_lib/session'
import { supabaseServer } from '../_lib/supabase'
import { Welcome } from '../_ui/Welcome'
import { ESTIMATE_USD } from '../../src/config'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ update?: string }> }) {
  const owner = await requireOwner()
  const updating = (await searchParams).update !== undefined
  // The name the invite carried, if any, to greet them by.
  let name: string | null = null
  if (authMode() === 'supabase') {
    const { data } = await (await supabaseServer()).auth.getClaims()
    const meta = (data?.claims as { user_metadata?: { name?: unknown } } | undefined)?.user_metadata
    name = typeof meta?.name === 'string' ? meta.name : null
  }
  const a = await allowance(owner)
  const note =
    a.capUsd < 10
      ? `Your research allowance is $${a.capUsd.toFixed(2)} a month: about ${Math.floor(a.capUsd / ESTIMATE_USD.deep)} full researches or ${Math.floor(a.capUsd / ESTIMATE_USD.triage)} quick checks. It resets on the 1st.`
      : null
  return <Welcome name={name} updating={updating} allowance={note} />
}
