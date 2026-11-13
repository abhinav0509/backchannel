// Strip the fragment and trailing slash so the same page matches however it was written.
export function normalizeUrl(raw: string): string {
  const u = new URL(raw)
  u.hash = ''
  return u.toString().replace(/\/$/, '')
}

/**
 * Every evidence URL in a stage output that the web search did not actually return.
 * A non-empty result means the model cited a source it never retrieved.
 */
export function unretrievedEvidenceUrls(output: unknown, retrieved: Iterable<string>): string[] {
  const seen = new Set([...retrieved].map(normalizeUrl))
  const cited: string[] = []
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (v === null || typeof v !== 'object') return
    for (const [key, child] of Object.entries(v)) {
      if (key === 'evidence' && Array.isArray(child)) {
        for (const e of child) if (e && typeof e === 'object' && 'url' in e && typeof e.url === 'string') cited.push(e.url)
      } else if (key === 'evidence_urls' && Array.isArray(child)) {
        for (const u of child) if (typeof u === 'string') cited.push(u)
      }
      walk(child)
    }
  }
  walk(output)
  return [...new Set(cited.filter((u) => !URL.canParse(u) || !seen.has(normalizeUrl(u))))]
}
