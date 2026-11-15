import Link from 'next/link'
import { requireOwner } from '../_lib/session'
import { getProfile } from '../../src/server/api'
import type { Profile } from '../../src/types/profile'
import { ProfileForm } from '../_ui/ProfileForm'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const profile = (await getProfile(await requireOwner())).body as Profile | null
  return (
    <ProfileForm
      initial={profile}
      header={
        <Link href="/welcome?update" className="float-right mt-2 btn btn-quiet btn-sm">
          {profile ? 'Update from a CV' : 'Fill in from your CV'}
        </Link>
      }
    />
  )
}
