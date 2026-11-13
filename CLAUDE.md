# Backchannel

A company research agent for my job search. I paste a recruiter email, it produces a sourced
due-diligence report on the company.

## Current phase

Phase 0: CLI only. No UI, no database, no web framework. If a task seems to need one, ask first.

## Principles that override convenience

1. **Evidence or it is dropped.** Every factual claim carries at least one source URL with a
   retrieved-at date. Zod rejects claims with no evidence. A dropped claim goes into `gaps`.
2. **Gaps are output.** What the agent could not establish is as important as what it found.
3. **Never fabricate.** Compensation, revenue and headcount are sourced or absent. No estimates
   dressed as data, in code or in prompts.
4. **Resolve the entity before researching it.** Below 0.8 confidence, stop and ask the user.
5. **Budgets are enforced, not suggested.** Hard caps on searches and tokens. Partial report over a
   runaway bill.
6. **Do not scrape** Glassdoor, LinkedIn, AmbitionBox or Blind. Search and permitted fetches only.

## Conventions

- TypeScript strict. No `any`. No non-null assertions without a comment saying why.
- Zod schema is the single source of truth for every shape crossing a boundary. Derive TS types from
  the schema with `z.infer`, do not write them twice.
- One stage per file. A stage is: input type, prompt, output schema, budget. No shared mutable state.
- Every LLM call goes through `llm/call.ts`. No direct SDK calls from stage files.
- Prompts live in the stage file they belong to, as exported template functions. Not in a prompts/
  folder, not in the database, not inline in the middle of logic.
- Cache by `(company_domain, stage, prompt_hash)`. A prompt change invalidates its own cache only.
- Log structured JSON to stderr, human-readable summary to stdout.

## Testing

- `npm run eval` runs the five-company eval set. Run it after any prompt change, without exception.
  Prompt regressions are silent otherwise.
- Unit tests for parsing, schema validation, budget enforcement and cost accounting.
- Do not add a company to the eval set without hand-checking the ground truth yourself. A wrong
  fixture is worse than no fixture.

## Commands

- `npm run dev -- research --file <path>` run on a file
- `npm run dev -- research --text "<jd text>"` run on pasted text
- `npm run eval` run the eval set
- `npm run typecheck`

## What not to do

- Do not add dependencies without asking.
- Do not add Phase 1 features (web UI, Supabase, Inngest) in Phase 0.
- Do not widen a type to make an error go away. Fix the shape or ask.
- Do not silently retry past the configured limit.
- Do not write a fact into a prompt as an example that could be mistaken for ground truth.
