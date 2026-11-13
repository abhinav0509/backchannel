'use client'

import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '../_lib/supabase-browser'

export function SignOut() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="rounded-md t-small text-ink-2 hover:text-ink"
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
