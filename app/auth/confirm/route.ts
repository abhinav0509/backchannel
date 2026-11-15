import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { supabaseServer } from '../../_lib/supabase'

export const dynamic = 'force-dynamic'

const TYPES: EmailOtpType[] = ['email', 'invite', 'magiclink', 'signup', 'recovery', 'email_change']

/**
 * Where the invitation and sign-in emails link. The token is verified here on the server, so the
 * link works on any device, unlike a code exchange that needs the browser that asked for it.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  if (token_hash && type && TYPES.includes(type)) {
    const { error } = await (await supabaseServer()).auth.verifyOtp({ token_hash, type })
    if (!error) return NextResponse.redirect(new URL(type === 'invite' ? '/welcome' : '/', url))
  }
  return NextResponse.redirect(new URL('/login?link=expired', url))
}
