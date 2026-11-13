'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Re-renders the server page every few seconds while research is running, so the inbox stays current. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(t)
  }, [active, router])
  return null
}
