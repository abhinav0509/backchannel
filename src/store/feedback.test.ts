import { beforeEach, describe, expect, it } from 'vitest'
import { useTestDb } from '../db/db'
import { addFeedback, listFeedback } from './feedback'

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'

beforeEach(async () => {
  await useTestDb()
})

describe('feedback', () => {
  it('keeps what someone wrote and the page they wrote it on, newest first', async () => {
    await addFeedback(A, { page: '/o/1?tab=prep', message: ' The prep tab is great. ' })
    await addFeedback(B, { page: '/', message: 'Search feels slow.' })
    const all = await listFeedback()
    expect(all.map((f) => [f.owner_id, f.page, f.message])).toEqual([
      [B, '/', 'Search feels slow.'],
      [A, '/o/1?tab=prep', 'The prep tab is great.'],
    ])
    expect(all[0]!.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('rejects empty or overlong messages and anything but an app path', async () => {
    await expect(addFeedback(A, { page: '/', message: '   ' })).rejects.toThrow()
    await expect(addFeedback(A, { page: '/', message: 'x'.repeat(2001) })).rejects.toThrow()
    await expect(addFeedback(A, { page: 'https://evil.example', message: 'hi' })).rejects.toThrow()
  })

  it('caps each person at 20 a day, so a stuck button cannot flood the list', async () => {
    for (let i = 0; i < 20; i++) await addFeedback(A, { page: '/', message: `m${i}` })
    await expect(addFeedback(A, { page: '/', message: 'one more' })).rejects.toThrow(/20/)
    await expect(addFeedback(B, { page: '/', message: 'still fine' })).resolves.toBeUndefined()
  })
})
