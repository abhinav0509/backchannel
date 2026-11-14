// The one place model IDs live. Verified against the Models API at runtime before a search-enabled call.
export const MODELS = {
  parse: 'claude-haiku-5-5',
  research: 'claude-sonnet-5-5',
  synthesis: 'claude-opus-5-5',
} as const

// Hard limits, not warnings: on breach the run stops and returns a partial report.
export const BUDGETS = {
  monthlyUsd: 20, // no new run starts once this month's recorded spend reaches it
  triage: { searchesPerRun: 8, tokensPerRun: 200_000 },
  // Resolve, then six research stages (6 + 8 + 10 + 6 + 5 + 5 searches), then synthesis.
  deep: { searchesPerRun: 50, tokensPerRun: 1_100_000 },
} as const
