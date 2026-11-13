import { createHash } from 'node:crypto'
import { getDb } from '../db/db'

// The key is a hash of the whole request, so any change to a prompt, model or schema misses
// and invalidates only its own entries. Prompts carry the company domain and today's date.
export const cacheKey = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const [row] = await (await getDb()).query<{ value: T }>('select value from llm_cache where key = $1', [key])
  return row?.value
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  await (await getDb()).query(
    'insert into llm_cache (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value, created_at = now()',
    [key, JSON.stringify(value)],
  )
}
