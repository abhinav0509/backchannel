# Backchannel

A company research agent for my job search. I paste a recruiter email, it produces a sourced
due-diligence report on the company.

## Current phase

Phase 0 pipeline plus a local Phase 1 web app (Next.js in `app/`). Storage is JSON on disk in
`data/` behind `src/store/store.ts`; runs execute in-process via `src/store/runner.ts`. Supabase and
Inngest (PRD section 10) replace those two files when this needs hosting; nothing else should change.
Work test-first: write the failing test, then the code.

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
- Every API request is cached by a hash of the full request (`llm/client.ts`), which carries the
  domain, stage prompt and date. A prompt change invalidates its own entries only. `--fresh` bypasses.
- Search uses `web_search_20250305` on purpose: newer versions returned text without citations.
- Money and people extraction runs unconstrained (`constrained: false`): their schemas exceed the
  API's structured-output grammar limit.
- Log structured JSON to stderr, human-readable summary to stdout.

## Testing

- `npm run eval` runs the five-company eval set. Run it after any prompt change, without exception.
  Prompt regressions are silent otherwise.
- Unit tests for parsing, schema validation, budget enforcement and cost accounting.
- Do not add a company to the eval set without hand-checking the ground truth yourself. A wrong
  fixture is worse than no fixture.

## Commands

- `npm run web` the app at http://localhost:3210
- `npm run dev -- research --file <path>` quick check from the terminal (add `--deep` for full research)
- `npm test` unit tests (vitest)
- `npm run eval` run the eval set
- `npm run typecheck`

## What not to do

- Do not add dependencies without asking.
- UI motion: ease-out, under 250ms, only in response to an action or to show progress. Respect reduced motion.
- Do not widen a type to make an error go away. Fix the shape or ask.
- Do not silently retry past the configured limit.
- Do not write a fact into a prompt as an example that could be mistaken for ground truth.
