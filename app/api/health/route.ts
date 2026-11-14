import { getDb } from '../../../src/db/db'
import { health } from '../../../src/server/auth'

export const dynamic = 'force-dynamic'

// Public on purpose: configuration names and kinds, and whether the database answers. Never values or data.
export async function GET() {
  let database_reachable: true | string
  try {
    await (await getDb()).query('select 1')
    database_reachable = true
  } catch (e) {
    // Postgres error codes and messages name the problem (bad password, unknown host) without echoing secrets.
    const err = e as { code?: string; message?: string }
    database_reachable = `${err.code ?? 'error'}: ${(err.message ?? '').replace(/postgres(ql)?:\/\/\S+/g, '<url>').slice(0, 160)}`
  }
  return Response.json({ ...health(), database_reachable })
}
