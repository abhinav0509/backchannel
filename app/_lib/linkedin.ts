type R = { title: string; location: string | null }

/** A LinkedIn people search. It opens in your own signed-in LinkedIn: we never fetch LinkedIn ourselves. */
export const linkedinSearch = (keywords: string) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`

/** A person's profile link, only when one came back as a search result cited for the claim. */
export const profileUrl = (evidence: { url: string }[]): string | null =>
  evidence.find((e) => {
    try {
      const u = new URL(e.url)
      return /(^|\.)linkedin\.com$/.test(u.hostname) && u.pathname.startsWith('/in/')
    } catch {
      return false
    }
  })?.url ?? null

const DISCIPLINES: [RegExp, string][] = [
  [/design|ux|ui\b|user experience|user research|researcher/i, 'design'],
  [/engineer|developer|sre\b|devops/i, 'engineering'],
  [/product manager|product owner|\bpm\b/i, 'product'],
  [/data|analytics|machine learning|\bml\b/i, 'data'],
  [/market/i, 'marketing'],
  [/sales|account exec/i, 'sales'],
]

/** Searches for the people around a role: who it likely reports to, the leadership above, and peers. */
export function roleSearches(company: string, role: R): { label: string; keywords: string }[] {
  const at = (s: string) => [company, s, role.location].filter(Boolean).join(' ')
  const discipline = DISCIPLINES.find(([re]) => re.test(role.title))?.[1]
  if (!role.title.trim()) return [{ label: 'Design and product leaders', keywords: `${company} head of design` }]
  if (!discipline) return [{ label: 'People in this role', keywords: at(role.title) }]
  return [
    { label: 'Likely managers', keywords: at(`${discipline} manager`) },
    { label: `Head of ${discipline}`, keywords: `${company} head of ${discipline}` },
    { label: 'Peers in this role', keywords: at(role.title) },
  ]
}
