import type { EvidenceRef } from '../../src/types/research'

export interface Source {
  n: number
  ref: EvidenceRef | null // null when only a score's evidence_urls cites it
}

/** Numbers every source once, in the order it first appears, for inline citation markers. */
export function sourceIndex(report: unknown): Map<string, Source> {
  const index = new Map<string, Source>()
  const add = (url: string, ref: EvidenceRef | null) => {
    const s = index.get(url)
    if (!s) index.set(url, { n: index.size + 1, ref })
    else if (!s.ref && ref) s.ref = ref
  }
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (typeof v !== 'object' || v === null) return
    for (const [k, child] of Object.entries(v)) {
      if (k === 'evidence' && Array.isArray(child)) for (const e of child as EvidenceRef[]) add(e.url, e)
      else if (k === 'evidence_urls' && Array.isArray(child)) for (const u of child as string[]) add(u, null)
      else walk(child)
    }
  }
  walk(report)
  return index
}
