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
  // Four research stages (6 + 8 + 10 + 6 searches) and synthesis.
  deep: { searchesPerRun: 40, tokensPerRun: 900_000 },
} as const
