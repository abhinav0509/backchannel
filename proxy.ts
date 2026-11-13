import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { authDisabled } from './src/server/auth'

// Refreshes the Supabase session on every page request and sends signed-out visitors to /login.
// The allowlist check happens server-side in app/_lib/session.ts; this only handles the session.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key || authDisabled()) return NextResponse.next() // local or open mode: no sign-in

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of list) response.cookies.set(name, value, options)
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v)
      },
    },
  })
  const { data } = await supabase.auth.getClaims()
  const path = request.nextUrl.pathname
  if (!data?.claims && !path.startsWith('/login') && !path.startsWith('/auth/') && !path.startsWith('/setup') && !path.startsWith('/api/')) {
    const to = request.nextUrl.clone()
    to.pathname = '/login'
    return NextResponse.redirect(to)
  }
  return response
}

export const config = {
  // Durable workflow callbacks (.well-known/workflow) must never pass through auth.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.well-known/workflow/).*)'],
}
