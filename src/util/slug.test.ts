import { describe, expect, it } from 'vitest'
import { slug } from './slug.js'

describe('slug', () => {
  it('lowercases, joins with dashes and drops punctuation', () => expect(slug('Sonatype, Inc.', 'Lead Product Designer')).toBe('sonatype-inc-lead-product-designer'))
  it('handles accents and empty parts', () => expect(slug('Société Générale', '')).toBe('societe-generale'))
  it('never returns empty', () => expect(slug('!!!')).toBe('untitled'))
  it('caps length', () => expect(slug('a'.repeat(200)).length).toBeLessThanOrEqual(80))
})
