// web_search_20250305 on purpose, not the newer dynamic-filtering versions: those route results
// through code execution and the final text came back with no citations (probed 2026-11-13),
// and citations are where every evidence record comes from. Re-probe before upgrading.
//
// No blocked_domains: search snippets quoting Glassdoor, LinkedIn, AmbitionBox or Blind are how
// review scores are found. What is banned is fetching those sites, and web_fetch is never enabled.
export function webSearchTool(maxUses: number) {
  return { type: 'web_search_20250305', name: 'web_search', max_uses: maxUses } as const
}
