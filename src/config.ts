// The one place model IDs live. Verified against the Models API at runtime before a search-enabled call.
export const MODELS = {
  parse: 'claude-haiku-5-5',
  research: 'claude-sonnet-5-5',
  synthesis: 'claude-opus-5-5',
} as const

// Hard limits, not warnings: on breach the run stops and returns a partial report.
export const BUDGETS = {
  monthlyUsd: 40, // no new run starts once this month's recorded spend, everyone's, reaches it
  memberMonthlyUsd: 5, // each invitee's own monthly limit; the admin has only the overall cap
  triage: { searchesPerRun: 8, tokensPerRun: 200_000 },
  // Resolve, then six research stages (6 + 8 + 10 + 6 + 5 + 5 searches), then synthesis.
  deep: { searchesPerRun: 50, tokensPerRun: 1_100_000 },
} as const

// What a run usually costs, to refuse one up front that would stop half way for want of budget.
export const ESTIMATE_USD = { triage: 0.35, deep: 2.2 } as const
