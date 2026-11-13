import { NextResponse } from 'next/server'
import { supabaseServer } from '../../_lib/supabase'

export const dynamic = 'force-dynamic'

/** The emailed link lands here. Works in the browser that asked for it; otherwise the 6-digit code does. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  if (code) {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL('/', url))
  }
  return NextResponse.redirect(new URL('/login?link=expired', url))
}
