import { getDb } from '../../../src/db/db'
import { health } from '../../../src/server/auth'

export const dynamic = 'force-dynamic'

// Public on purpose: configuration names and kinds, and whether the database answers. Never values or data.
// shortcut: temporary diagnostic for a hang under parallel queries; remove once understood.
async function probe(n: number) {
  const db = await getDb()
  const t0 = Date.now()
  const one = (i: number) =>
    Promise.race([
      db.query('select $1::int as i', [i]).then(() => Date.now() - t0),
      new Promise<string>((r) => setTimeout(() => r('timeout'), 8000)),
    ]).catch((e: unknown) => String(e).slice(0, 80))
  return Promise.all(Array.from({ length: n }, (_, i) => one(i)))
}

export async function GET(req: Request) {
  const n = Number(new URL(req.url).searchParams.get('parallel'))
  if (n > 0 && n <= 12) return Response.json({ parallel: await probe(n) })
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
