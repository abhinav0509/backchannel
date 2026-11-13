import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrate, openDb } from './db'

describe('db', () => {
  it('opens an in-memory Postgres and round-trips parameters, JSON and timestamps', async () => {
    const db = openDb('pglite:memory')
    const [row] = await db.query<{ n: number; j: { a: number[] }; t: Date }>('select $1::int as n, $2::jsonb as j, now() as t', [7, JSON.stringify({ a: [1] })])
    expect(row).toMatchObject({ n: 7, j: { a: [1] } })
    expect(row?.t).toBeInstanceOf(Date)
    await db.close()
  })

  it('applies the migrations once, and again is a no-op', async () => {
    const db = openDb('pglite:memory')
    expect(await migrate(db)).toEqual(['0001_init.sql'])
    expect(await migrate(db)).toEqual([])
    const tables = await db.query<{ t: string }>("select tablename as t from pg_tables where schemaname = 'public' order by 1")
    expect(tables.map((r) => r.t)).toEqual(['llm_cache', 'opportunities', 'profiles', 'run_events', 'runs', 'schema_migrations', 'spend'])
    await db.close()
  })

  it('has row level security on every app table', async () => {
    const db = openDb('pglite:memory')
    await migrate(db)
    const rows = await db.query<{ t: string; rls: boolean }>("select relname as t, relrowsecurity as rls from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname <> 'schema_migrations'")
    expect(rows.every((r) => r.rls)).toBe(true)
    await db.close()
  })

  it('creates the directory for an on-disk database, and the data persists across reopening', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'bc-pg-')), 'nested', 'pglite')
    const a = openDb(`pglite:${dir}`)
    await migrate(a)
    await a.query("insert into llm_cache (key, value) values ('k', '1')")
    await a.close()
    const b = openDb(`pglite:${dir}`)
    expect(await b.query('select key from llm_cache')).toEqual([{ key: 'k' }])
    await b.close()
  })

  it('refuses an unknown database URL', () => expect(() => openDb('mysql://x')).toThrow(/DATABASE_URL/))
})
