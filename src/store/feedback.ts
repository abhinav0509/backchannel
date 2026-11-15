import { z } from 'zod'
import { getDb } from '../db/db'

const Feedback = z.object({
  page: z.string().max(500).regex(/^\/[^/]/, 'an app path').or(z.literal('/')),
  message: z.string().trim().min(1, 'write something first').max(2000),
})

const PER_DAY = 20

/** Saves a note from inside the app with the page it was written on. */
export async function addFeedback(owner: string, body: unknown): Promise<void> {
  const f = Feedback.parse(body)
  const db = await getDb()
  const [today] = await db.query<{ n: number }>("select count(*)::int as n from feedback where owner_id = $1 and created_at > now() - interval '1 day'", [owner])
  if ((today?.n ?? 0) >= PER_DAY) throw new Error(`at most ${PER_DAY} notes a day`)
  await db.query('insert into feedback (owner_id, page, message) values ($1, $2, $3)', [owner, f.page, f.message])
}

export interface FeedbackRow {
  id: number
  owner_id: string
  page: string
  message: string
  created_at: string
}

/** Everyone's feedback, newest first. For the admin only. */
export async function listFeedback(limit = 200): Promise<FeedbackRow[]> {
  const rows = await (await getDb()).query<Omit<FeedbackRow, 'created_at'> & { created_at: Date }>(
    'select id::int as id, owner_id, page, message, created_at from feedback order by created_at desc, id desc limit $1',
    [limit],
  )
  return rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }))
}
