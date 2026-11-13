// No blocked_domains: search snippets quoting Glassdoor, LinkedIn, AmbitionBox or Blind are how
// review scores are found. What is banned is fetching those sites, and web_fetch is never enabled.
export function webSearchTool(maxUses: number) {
  return { type: 'web_search_20260318', name: 'web_search', max_uses: maxUses } as const
}
