import { redirect } from 'next/navigation'
import { BUDGETS } from '../../src/config'
import { currentUser, requireOwner } from '../_lib/session'
import { People } from '../_ui/People'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireOwner()
  if ((await currentUser())?.role !== 'admin') redirect('/')
  return <People capUsd={BUDGETS.memberMonthlyUsd} />
}
