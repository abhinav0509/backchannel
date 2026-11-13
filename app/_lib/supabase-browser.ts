'use client'

import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

/** The browser client, or null when the app runs locally without Supabase. */
export const supabaseBrowser = () => (url && key ? createBrowserClient(url, key) : null)
