import { describe, expect, it } from 'vitest'
import { questionsForRound } from './rounds'

const q = (topic: string, n = 1) => Array.from({ length: n }, (_, i) => ({ question: `${topic} ${i}`, why: 'w', topic: topic as never }))

describe('questionsForRound', () => {
  const all = [...q('comp'), ...q('role', 2), ...q('team'), ...q('culture'), ...q('company'), ...q('money'), ...q('future'), ...q('ai')]
  it('a recruiter screen covers the role, pay and terms first', () =>
    expect(questionsForRound('recruiter_screen', all).map((x) => x.topic)).toEqual(['role', 'role', 'comp', 'team']))
  it('a hiring manager round covers the role, team and how they work', () =>
    expect(new Set(questionsForRound('hiring_manager', all).map((x) => x.topic))).toEqual(new Set(['role', 'team', 'culture', 'future'])))
  it('a final round turns to the company’s money and direction', () =>
    expect(questionsForRound('final', all).map((x) => x.topic)).toEqual(expect.arrayContaining(['money', 'future', 'comp'])))
  it('never more than five, and falls back to all topics when a round has none of its own', () => {
    expect(questionsForRound('panel', [...q('role', 9)]).length).toBe(5)
    expect(questionsForRound('recruiter_screen', q('ai', 2)).map((x) => x.topic)).toEqual(['ai', 'ai'])
  })
})
