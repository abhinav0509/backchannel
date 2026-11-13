import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import postgres from 'postgres'

/** The whole database surface the app uses: parameterised queries and multi-statement scripts. */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>
  exec(script: string): Promise<void>
  close(): Promise<void>
}

// Supabase provides the auth schema and the authenticated role; local Postgres needs stand-ins
// so the same migration (with its RLS policies) runs unchanged.
const LOCAL_PRELUDE = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as 'select null::uuid';
do $$ begin
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;`

/**
 * DATABASE_URL forms: postgres://… (Supabase; use the transaction pooler on Vercel),
 * pglite:memory (tests), pglite:<dir> (local development, persisted on disk).
 */
export function openDb(url = process.env.DATABASE_URL ?? defaultUrl()): Db {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    // prepare: false because Supabase's transaction pooler does not support prepared statements.
    const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {} })
    return {
      query: async <T,>(text: string, params: unknown[] = []) => (await sql.unsafe(text, params as never[])) as unknown as T[],
      exec: async (script) => void (await sql.unsafe(script)),
      close: () => sql.end(),
    }
  }
  if (url.startsWith('pglite:')) {
    const where = url.slice('pglite:'.length)
    if (where !== 'memory') mkdirSync(where, { recursive: true })
    const pg = new PGlite(where === 'memory' ? undefined : where)
    const ready = pg.exec(LOCAL_PRELUDE)
    return {
      query: async <T,>(text: string, params: unknown[] = []) => (await ready, (await pg.query<T>(text, params)).rows),
      exec: async (script) => void (await ready, await pg.exec(script)),
      close: () => pg.close(),
    }
  }
  throw new Error('DATABASE_URL must be a postgres:// URL or pglite:<dir|memory>')
}

function defaultUrl(): string {
  // A hosted deployment without a database would silently lose everything: refuse instead.
  if (process.env.VERCEL) throw new Error('DATABASE_URL is not set. Add your Supabase connection string in the Vercel project settings.')
  return 'pglite:.data/pglite'
}

const MIGRATIONS = join(process.cwd(), 'db', 'migrations')

/** Applies every migration not yet recorded, in name order. Returns the ones it applied. */
export async function migrate(db: Db, dir = MIGRATIONS): Promise<string[]> {
  await db.exec('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())')
  const done = new Set((await db.query<{ name: string }>('select name from schema_migrations')).map((r) => r.name))
  const pending = readdirSync(dir).filter((f) => f.endsWith('.sql') && !done.has(f)).sort()
  for (const name of pending) {
    await db.exec(readFileSync(join(dir, name), 'utf8'))
    await db.query('insert into schema_migrations (name) values ($1)', [name])
  }
  return pending
}

// One connection pool per process, shared across Next's separately bundled routes.
const g = globalThis as typeof globalThis & { __backchannelDb?: Promise<Db> }

/** The process-wide database, migrated on first use for local PGlite. Supabase is migrated with `npm run db:migrate`. */
export function getDb(): Promise<Db> {
  return (g.__backchannelDb ??= (async () => {
    const db = openDb()
    if (!(process.env.DATABASE_URL ?? '').startsWith('postgres')) await migrate(db)
    return db
  })().catch((e: unknown) => {
    g.__backchannelDb = undefined // a failed connection must not be cached: the next request retries
    throw e
  }))
}

/** Tests: a fresh, migrated in-memory database installed as the process database. */
export async function useTestDb(): Promise<Db> {
  const db = openDb('pglite:memory')
  await migrate(db)
  g.__backchannelDb = Promise.resolve(db)
  return db
}
