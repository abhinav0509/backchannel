// The one place model IDs live. Verified against the Models API at runtime before a search-enabled call.
export const MODELS = {
  parse: 'claude-haiku-5-5',
  research: 'claude-sonnet-5-5',
  synthesis: 'claude-opus-5-5',
} as const

// Hard limits, not warnings: on breach the run stops and returns a partial report.
export const BUDGETS = {
  monthlyUsd: 20, // no new run starts once this month's recorded spend reaches it
  triage: { searchesPerRun: 6, tokensPerRun: 120_000 },
  deep: { searchesPerRun: 40, tokensPerRun: 600_000 },
} as const
