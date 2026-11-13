import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createOpportunity, getOpportunity, listOpportunities, updateOpportunity } from './store.js'

beforeEach(() => {
  process.env.BACKCHANNEL_DATA_DIR = mkdtempSync(join(tmpdir(), 'bc-data-'))
})

describe('store', () => {
  it('creates an opportunity from pasted text', () => {
    const o = createOpportunity('Hi, a role at Example.')
    expect(o).toMatchObject({ text: 'Hi, a role at Example.', status: 'idle', company: null, report: null, triage: null, runs: [], events: [] })
    expect(o.id).toMatch(/^[a-z0-9]{10,}$/)
    expect(getOpportunity(o.id)).toEqual(o)
  })

  it('rejects empty text', () => expect(() => createOpportunity('   ')).toThrow(/empty/))

  it('returns null for an unknown or unsafe id', () => {
    expect(getOpportunity('nope123456')).toBeNull()
    expect(getOpportunity('../../etc/passwd')).toBeNull()
  })

  it('lists newest first', async () => {
    const a = createOpportunity('first')
    await new Promise((r) => setTimeout(r, 5))
    const b = createOpportunity('second')
    expect(listOpportunities().map((o) => o.id)).toEqual([b.id, a.id])
  })

  it('updates through a function and stamps updated_at, writing atomically', async () => {
    const o = createOpportunity('x')
    await new Promise((r) => setTimeout(r, 5))
    const u = updateOpportunity(o.id, (d) => ({ ...d, company: 'Example' }))
    expect(u.company).toBe('Example')
    expect(u.updated_at > o.updated_at).toBe(true)
    expect(getOpportunity(o.id)?.company).toBe('Example')
    expect(readdirSync(join(process.env.BACKCHANNEL_DATA_DIR!, 'opportunities')).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('refuses an update that breaks the schema', () => {
    const o = createOpportunity('x')
    expect(() => updateOpportunity(o.id, (d) => ({ ...d, status: 'bogus' as never }))).toThrow()
    expect(getOpportunity(o.id)?.status).toBe('idle')
  })
})
