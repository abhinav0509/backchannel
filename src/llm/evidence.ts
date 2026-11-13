import type { z } from 'zod'

// Strip the fragment and trailing slash so the same page matches however it was written.
export function normalizeUrl(raw: string): string {
  const u = new URL(raw)
  u.hash = ''
  return u.toString().replace(/\/$/, '')
}

const isRec = (v: unknown): v is Record<PropertyKey, unknown> => typeof v === 'object' && v !== null

/**
 * Removes every cited URL the web search did not actually return, from `evidence` and
 * `evidence_urls` arrays anywhere in the value. Mutates the value; returns what was removed.
 */
export function stripUnretrieved(value: unknown, retrieved: Iterable<string>): string[] {
  const seen = new Set([...retrieved].map(normalizeUrl))
  const known = (u: unknown) => typeof u === 'string' && URL.canParse(u) && seen.has(normalizeUrl(u))
  const removed = new Set<string>()
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (!isRec(v)) return
    for (const [k, child] of Object.entries(v)) {
      if ((k === 'evidence' || k === 'evidence_urls') && Array.isArray(child)) {
        const urlOf = (e: unknown) => (k === 'evidence' && isRec(e) ? e.url : e)
        for (const e of child) if (!known(urlOf(e))) removed.add(String(urlOf(e)))
        v[k] = child.filter((e) => known(urlOf(e)))
      } else {
        walk(child)
      }
    }
  }
  walk(value)
  return [...removed]
}

/** Every URL in `evidence` and `evidence_urls` arrays, once each, in the order first met. */
export function collectEvidenceUrls(value: unknown): string[] {
  const urls = new Set<string>()
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (!isRec(v)) return
    for (const [k, child] of Object.entries(v)) {
      if (k === 'evidence' && Array.isArray(child)) for (const e of child) isRec(e) && typeof e.url === 'string' && urls.add(e.url)
      else if (k === 'evidence_urls' && Array.isArray(child)) for (const u of child) typeof u === 'string' && urls.add(u)
      else walk(child)
    }
  }
  walk(value)
  return [...urls]
}

type Path = readonly PropertyKey[]

// Later array indices first, so splicing one item never shifts another we still have to drop.
function descending(a: Path, b: Path): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i]
    const y = b[i]
    if (x === y) continue
    if (typeof x === 'number' && typeof y === 'number') return y - x
    return String(y).localeCompare(String(x))
  }
  return b.length - a.length
}

function drop(root: unknown, path: Path): void {
  let parent: unknown = root
  for (const k of path.slice(0, -1)) parent = isRec(parent) ? parent[k] : undefined
  const key = path.at(-1)
  if (Array.isArray(parent) && typeof key === 'number') parent.splice(key, 1)
  else if (isRec(parent) && key !== undefined) parent[key] = null
}

export type Validated<T> = { ok: true; data: T; dropped: string[] } | { ok: false; issues: string }

/**
 * Parses model output and enforces "evidence or it is dropped":
 * 1. cited URLs the search never returned are removed;
 * 2. any claim or flag left with no evidence is dropped (array item removed, nullable field set to null);
 * 3. what remains must pass the schema. Nothing is repaired by inventing a source.
 * `dropped` lists what was removed, for the report's gaps.
 */
export function validateSourced<S extends z.ZodType>(text: string, schema: S, retrieved?: Iterable<string>): Validated<z.output<S>> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    return { ok: false, issues: `not valid JSON: ${err instanceof Error ? err.message : String(err)}` }
  }

  const dropped = retrieved ? stripUnretrieved(raw, retrieved).map((u) => `removed a citation the search never returned: ${u}`) : []
  let result = schema.safeParse(raw)
  if (!result.success) {
    const unsourced = result.error.issues
      .filter((i) => i.path.at(-1) === 'evidence' && i.path.length > 1)
      .map((i) => i.path.slice(0, -1))
      .sort(descending)
    for (const p of unsourced) {
      drop(raw, p)
      dropped.push(`dropped an unsourced claim at ${p.join('.')}`)
    }
    if (unsourced.length) result = schema.safeParse(raw)
  }
  if (!result.success) {
    const issues = result.error.issues.slice(0, 20).map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
    return { ok: false, issues: [...issues, ...dropped.map((d) => `- note: ${d}`)].join('\n') }
  }
  return { ok: true, data: result.data, dropped }
}
