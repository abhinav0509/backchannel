'use client'

import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '../_lib/supabase-browser'

export function SignOut() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        await supabaseBrowser()?.auth.signOut()
        router.replace('/login')
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}
