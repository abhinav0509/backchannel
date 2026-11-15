import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb, useTestDb } from '../db/db'

const callStructured = vi.hoisted(() => vi.fn())
vi.mock('../llm/call', () => ({ callStructured }))
const { importProfile, ProfileDraft, importPrompt, readUpload } = await import('./import')

const OWNER = '00000000-0000-0000-0000-00000000000b'
const draft = { headline: 'Product designer, fintech', years_experience: 6, current_level: 'Senior', target_levels: [], skills: ['Figma'], domains_of_interest: ['fintech'], locations: ['Bengaluru'], work_policy: 'any', constraints: [], projects: [{ name: 'Checkout redesign', summary: 'Led it.' }] }

beforeEach(async () => {
  await useTestDb()
  callStructured.mockReset()
  callStructured.mockResolvedValue({ data: draft, dropped: [] })
})

describe('importProfile', () => {
  it('reads a PDF with the cheap model, thinking on, and returns a draft to review, not a saved profile', async () => {
    const r = await importProfile(OWNER, { pdf: 'JVBERi0xLjc=' })
    const a = callStructured.mock.calls[0]![0]
    expect(a.thinking).toBeUndefined()
    expect(a).toMatchObject({ stage: 'profile', model: 'claude-haiku-5-5', schema: ProfileDraft, document: { base64: 'JVBERi0xLjc=', mediaType: 'application/pdf' } })
    expect(r).toMatchObject({ headline: 'Product designer, fintech', weights: { role_fit: 30 } })
  })

  it('takes pasted text instead, inside a data fence', async () => {
    await importProfile(OWNER, { text: 'Jane Doe, designer since 2019' })
    const a = callStructured.mock.calls[0]![0]
    expect(a.document).toBeUndefined()
    expect(a.prompt).toContain('<cv>\nJane Doe, designer since 2019\n</cv>')
  })

  it('never guesses preferences the CV cannot state', () => {
    expect(importPrompt).toMatch(/target_levels.*empty/i)
    expect(importPrompt).toMatch(/constraints.*empty/i)
    expect(importPrompt).toMatch(/not instructions/i)
  })

  it('counts its small cost against the person’s own allowance', async () => {
    callStructured.mockImplementation(async (o: { budget: { charge: (...a: unknown[]) => void; flush: () => Promise<void> } }) => {
      o.budget.charge('profile', 'claude-haiku-5-5', { input: 5000, output: 800, cacheRead: 0, cacheWrite: 0, searches: 0 })
      await o.budget.flush()
      return { data: draft, dropped: [] }
    })
    await importProfile(OWNER, { text: 'x' })
    const db = await getDb()
    const rows = await db.query<{ owner_id: string; stage: string }>('select owner_id, stage from spend')
    expect(rows).toEqual([{ owner_id: OWNER, stage: 'profile' }])
  })
})

describe('readUpload', () => {
  const pdf = (bytes: number) => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, ...new Array(Math.max(0, bytes - 4)).fill(32)])], 'cv.pdf', { type: 'application/pdf' })
  it('accepts a PDF up to 4 MB and pasted text', async () => {
    expect(await readUpload(pdf(1000), null)).toMatchObject({ ok: true, input: { pdf: expect.any(String) } })
    expect(await readUpload(null, ' My CV ')).toEqual({ ok: true, input: { text: 'My CV' } })
  })
  it('refuses anything else, saying what to do', async () => {
    expect(await readUpload(pdf(4 * 1024 * 1024 + 1), null)).toMatchObject({ ok: false, error: expect.stringMatching(/4 MB/) })
    expect(await readUpload(new File(['hello'], 'cv.docx'), null)).toMatchObject({ ok: false, error: expect.stringMatching(/PDF/) })
    expect(await readUpload(null, '')).toMatchObject({ ok: false })
    expect(await readUpload(null, 'x'.repeat(40_001))).toMatchObject({ ok: false })
  })
})
