# Scout: Claude Code kickoff pack

Four things in this file:

1. **The kickoff prompt.** Paste into Claude Code in an empty folder.
2. **CLAUDE.md.** Save at the repo root before you run anything.
3. **Appendices.** The type contract, the stage prompt skeleton, the eval set.
4. **The Phase 1 prompt.** Use only after Phase 0 is working.

One rule for yourself: do not skip to Phase 1. Phase 0 has no interface on purpose. If the agent does
not produce a good report, nothing else matters, and you want to know that in two days rather than
two weeks.

---

## 1. The kickoff prompt

> Copy everything between the lines into Claude Code.

---

I am building **Scout**, a company research agent for my own job search. This is Phase 0: a
command-line tool with no web interface. Do not build a UI, a database, or a web framework in this
phase. If you find yourself writing React, stop and ask me.

### What it does

I paste in the text of a recruiter email or job description. The tool researches the company using
the Claude API with its web search tool, and writes out two files:

- `out/<slug>.json` matching the `CompanyResearch` type exactly
- `out/<slug>.md` a readable report generated from that JSON

### Stack

- TypeScript, Node 20+, ESM
- `@anthropic-ai/sdk`
- `zod` for schema validation
- `commander` for the CLI
- `vitest` for tests
- `dotenv`
- No database. JSON files on disk in `out/` and `cache/`.

### Project layout

```
src/
  cli.ts                  entry point
  pipeline/
    run.ts                orchestrates stages, handles parallelism and budgets
    stage0-parse.ts
    stage1-resolve.ts
    stage3-money.ts
    stage4-people.ts
    stage8-synthesize.ts
  llm/
    client.ts             Anthropic client, retries, token and cost accounting
    search.ts             web search tool config and budget enforcement
    call.ts               one typed call: prompt + zod schema -> validated object
  types/
    research.ts           the CompanyResearch contract (I supply this, see below)
    profile.ts            my candidate profile type
  report/
    markdown.ts           JSON -> markdown
  util/
    slug.ts, cache.ts, cost.ts, log.ts
evals/
  fixtures/               5 companies with hand-written ground truth
  run-evals.ts
profile.json              my candidate profile, gitignored
out/                      gitignored
cache/                    gitignored
```

### Stages for Phase 0

Build only these five. Stages 2, 5, 6 and 7 come in Phase 2, so leave clean seams for them.

| # | Stage | Job |
|---|-------|-----|
| 0 | Parse | Pull company name, role title, level, location, recruiter and any comp from the raw text. No web calls. Cheapest model. |
| 1 | Resolve | Identify the actual company: legal name, domain, HQ, founded year, public or private. Return a confidence score. |
| 3 | Money | Ownership type, funding events, PE or VC backers, M&A, revenue and profitability signals, sale or IPO activity. |
| 4 | People | Headcount and its trend, layoff events with dates and sizes, leadership changes in the last 24 months, employee review scores by source with direction of travel. |
| 8 | Synthesize | Risk flags, green flags, six scores, questions to ask, a verdict paragraph, and an explicit list of what could not be established. No web calls. |

Stages 0 and 1 run in sequence. Stages 3 and 4 run in parallel. Stage 8 runs last.

### Non-negotiable rules

**Entity resolution gates everything.** When I researched Sonatype by hand, searches returned Sonata
Software, Sonatus and Sonix as well. Three different companies, all plausible. If stage 1 returns
confidence below 0.8, the CLI must stop, print the candidate companies it found with their domains,
and ask me to choose. Never guess past this point. Add `--company-domain` so I can skip the prompt.

**Every claim carries evidence.** The `Claim<T>` wrapper requires at least one evidence reference.
Zod validation rejects a claim with an empty evidence array. When the model returns one, drop that
claim and record it in the `gaps` array instead. Do not let an unsourced claim through, and do not
repair it by inventing a source.

**State what you could not find.** The `gaps` array is a required output, not an afterthought. A
report that silently omits what it could not establish reads as more confident than it is.

**Never fabricate numbers.** Compensation, revenue and headcount are either sourced or absent. If the
model wants to estimate, it goes in `gaps`. Job aggregators publish AI-generated salary guesses that
look authoritative; treat anything from them as unverified at best.

**Do not scrape.** No requests to Glassdoor, LinkedIn, AmbitionBox or Blind. All of them prohibit it
and block it. The web search tool returns result snippets that already surface aggregate review
scores and review text, which is how the manual research worked. Use search, plus fetching pages that
permit it.

**Budgets are hard limits, not warnings.** Cap searches per stage with `max_uses` on the web search
tool. Default total: 40 searches per run. Cap tokens per run. On breach, return a partial report and
mark it partial. Log tokens, searches and cost per stage and print a summary at the end of every run.

### Models

Use three tiers and put the IDs in one config file so I can change them in one place:

- **parse and extract** (stages 0, and any formatting): the cheapest current Haiku-class model
- **research** (stages 1, 3, 4): a current Sonnet-class model
- **synthesis** (stage 8): a current Opus-class model

Do not hardcode model IDs from memory. Read the current list from the Models API, or ask me and I
will paste the current IDs in. Check the model's `capabilities.server_tools.web_search.supported`
field before sending a request with the search tool.

The web search tool is a server-side tool: `{"type": "web_search_20250305", "name": "web_search",
"max_uses": N}`. It supports `allowed_domains`, `blocked_domains` and `user_location`, and returns
citations in the response, which is where the evidence records come from. Newer versions exist with
dynamic filtering and response-inclusion controls; check the docs and use the newest one the chosen
model supports.

### Order of work

Work in this order and stop at each checkpoint for me to look.

1. **Types and schemas first.** `src/types/research.ts` from the contract I supply below, with the
   matching zod schemas. Nothing else until this compiles.
2. **The eval harness, before any prompt.** `evals/` with five companies and hand-written ground
   truth. Each eval asserts specific checkable facts, for example: ownership type is `pe_backed`, at
   least one layoff event in 2023, HQ country is US. Make it runnable as `npm run eval`. It will fail
   at this point. That is correct.
3. **`llm/call.ts`.** One typed call: a prompt plus a zod schema returns a validated object, with
   retry on validation failure (max 2 retries, feeding the validation error back), token and cost
   accounting, and search budget enforcement.
4. **Stage 0 and stage 1,** with the disambiguation gate. Checkpoint: show me the resolution output
   for three test inputs including one deliberately ambiguous name.
5. **Stages 3 and 4,** running in parallel. Checkpoint.
6. **Stage 8** and the markdown report. Checkpoint.
7. **Run the evals.** Iterate on prompts until they pass. Show me each failure before you change a
   prompt to fix it; some failures will mean my ground truth is wrong, not the prompt.

### Done when

I can run this and the output is as good as two hours of careful manual research:

```
npx tsx src/cli.ts research --file ./samples/recruiter-email.txt
```

### Before you start

Read the contract in the next section, then tell me:
1. Anything in it you think is wrong or will be awkward to implement
2. Your plan for the first checkpoint
3. Any question where guessing would cost me a rewrite

Do not start writing code until I have answered.

---

## 2. CLAUDE.md

> Save this at the repo root. Claude Code reads it automatically on every session.

```markdown
# Scout

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
```

---

## Appendix A: the type contract

> `src/types/research.ts`. Write the zod schemas and derive the types from them.

```ts
export type Confidence = 'confirmed' | 'reported' | 'unverified'
export type TrustTier  = 'primary' | 'secondary' | 'tertiary'

export interface EvidenceRef {
  url: string
  title: string
  publisher: string | null
  published_at: string | null   // ISO date, null if the page gives none
  retrieved_at: string          // ISO datetime
  snippet: string               // the text that supports the claim, <= 300 chars
  trust_tier: TrustTier
}

/** Nothing factual exists outside this wrapper. */
export interface Claim<T> {
  value: T
  confidence: Confidence
  evidence: EvidenceRef[]       // length >= 1, enforced by zod
  as_of: string | null          // the date the value describes, not when it was found
  note?: string
}

export interface FundingEvent {
  date: string | null
  round: string | null          // 'Series C', 'majority investment', 'acquisition'
  amount_usd: number | null
  investors: string[]
}

export interface LayoffEvent {
  date: string | null
  headcount: number | null
  percentage: number | null
  scope: string | null          // 'company-wide', 'sales and engineering'
  handling_notes: string | null // how it was communicated, if reported
}

export interface LeadershipChange {
  date: string | null
  role: string                  // 'CEO', 'CRO'
  person_in: string | null
  person_out: string | null
  direction: 'appointment' | 'departure' | 'transition'
}

export interface ReviewScore {
  source: string                // 'Glassdoor', 'Blind', 'AmbitionBox'
  score: number
  scale: number                 // almost always 5
  sample_size: number | null
  trend: 'rising' | 'flat' | 'falling' | 'unknown'
  as_of: string | null
}

export type FlagKind =
  | 'layoff_history' | 'pe_ownership' | 'leadership_churn' | 'sentiment_decline'
  | 'cost_centre_risk' | 'site_immaturity' | 'role_ambiguity' | 'level_mismatch'
  | 'funding_risk' | 'market_commoditisation' | 'attrition_signal' | 'rto_change'
  | 'site_growth' | 'profitable' | 'category_leader' | 'durable_moat'
  | 'rare_role' | 'product_charter' | 'domain_fit' | 'design_maturity'
  | 'public_comp_band' | 'tenure_signal'

export interface Flag {
  kind: FlagKind
  polarity: 'risk' | 'green'
  severity: 1 | 2 | 3 | 4 | 5
  title: string                 // one line
  detail: string                // two or three sentences
  evidence: EvidenceRef[]
}

export type ScoreDimension =
  | 'role_fit' | 'company_health' | 'job_security'
  | 'career_signal' | 'culture' | 'comp_confidence'

export interface Score {
  dimension: ScoreDimension
  value: number                 // 0 to 100
  rationale: string             // why this number, in one or two sentences
  evidence_urls: string[]
  unknown: boolean              // true when there was not enough to judge; value is then ignored
}

export interface CompanyResearch {
  schema_version: 2
  generated_at: string
  partial: boolean              // true if a budget was hit or a stage failed

  identity: {
    legal_name: Claim<string>
    display_name: string
    domain: string
    hq: Claim<string>
    founded_year: Claim<number> | null
    is_public: Claim<boolean>
    resolution_confidence: number
  }

  money: {
    ownership_type: Claim<'public' | 'pe_backed' | 'vc_backed' | 'bootstrapped' | 'subsidiary' | 'unknown'>
    funding_events: Claim<FundingEvent>[]
    revenue_signal: Claim<string> | null
    profitability: Claim<string> | null
    exit_activity: Claim<string>[]      // sale processes, IPO chatter, acquisitions
  }

  people: {
    headcount: Claim<number> | null
    headcount_trend: Claim<{ year: number; count: number }[]> | null
    layoff_events: Claim<LayoffEvent>[]
    leadership_changes: Claim<LeadershipChange>[]
    review_scores: Claim<ReviewScore>[]
  }

  role: {
    title: string
    level_claimed: string | null
    location: string | null
    work_policy: 'onsite' | 'hybrid' | 'remote' | 'unknown'
    employment_type: 'permanent' | 'contract' | 'rotation' | 'unknown'
    required_years: string | null
    extracted_requirements: string[]
  }

  flags: Flag[]
  scores: Score[]
  questions_to_ask: string[]    // 6 to 10, specific to what was found, not generic
  verdict: string               // 3 to 5 sentences, states the main risk plainly
  gaps: string[]                // what could not be established and why it matters

  run: {
    searches_used: number
    input_tokens: number
    output_tokens: number
    cost_usd: number
    duration_ms: number
    stage_status: Record<string, 'ok' | 'partial' | 'failed'>
  }
}
```

---

## Appendix B: stage prompt skeleton

Every stage prompt follows the same shape. Keep the evidence and gap rules identical across all of
them so behaviour stays consistent.

```
You are researching {company_name} ({domain}) for a candidate deciding whether to
interview there. Today is {date}.

TASK
{what this specific stage must establish}

RULES
- Search for what you need. You have at most {max_uses} searches.
- Every factual claim must cite a source you actually retrieved in this conversation.
  Include the URL, the publisher, the publication date if the page shows one, and a
  short quoted snippet that supports the claim.
- Mark each claim: 'confirmed' if a primary source (company filing, press release,
  government registry) supports it; 'reported' if credible secondary press does;
  'unverified' if it rests on a single weak source.
- If you cannot establish something, say so in `gaps`. Do not estimate. Do not infer a
  number from an adjacent number.
- Do not use Glassdoor, LinkedIn, AmbitionBox or Blind directly. Search result
  snippets that quote them are acceptable, cited as the search result.
- Distinguish company claims from independent reporting. A press release saying the
  company is a leader is the company's claim, not a fact.

OUTPUT
Return only JSON matching this schema. No prose outside the JSON.
{schema}
```

---

## Appendix C: the eval set

Five companies, chosen so each one stresses something different. Write the ground truth by hand
before writing any prompt, and only assert facts you have personally checked.

| Company | What it tests |
|---------|---------------|
| Sonatype | PE ownership, repeated layoffs, an India GCC, a name that collides with three other companies |
| A large public company (Adobe, Atlassian) | Public filings, easy facts; the agent should be fast and confident here |
| A recently funded startup | Funding events, no review data, thin evidence; the agent should return many gaps rather than filling them |
| An Indian services company (Infosys, TCS) | High review volume, very different archetype, should not be mistaken for a product company |
| A deliberately ambiguous name | The disambiguation gate must fire rather than guessing |

Assert specific checkable facts, not vibes:

```ts
{
  input: 'samples/sonatype-email.txt',
  expect: {
    'identity.domain': 'sonatype.com',
    'money.ownership_type.value': 'pe_backed',
    'people.layoff_events.length': { min: 1 },
    'flags': { contains: ['layoff_history', 'pe_ownership'] },
    'gaps': { contains_match: /compensation/i },   // India comp data does not exist
  }
}
```

Assert on the **shape and the flags**, not on exact wording. Wording will change every time you
touch a prompt, and an eval that breaks on wording gets disabled within a week.

---

## Appendix D: the Phase 1 prompt

> Only after Phase 0 passes its evals and you have used it on a real opportunity.

Phase 0 is working. Now wrap it in a web app, reusing the pipeline code unchanged.

**Add:** Next.js App Router with TypeScript and Tailwind, shadcn/ui, Supabase (Postgres, Auth,
Storage, row level security on every table from the start), Inngest to run the pipeline as a step
function with one step per stage.

**Keep:** the `CompanyResearch` contract exactly as it is. The pipeline moves into an Inngest
function and nothing inside the stages changes. If a stage file needs editing to make this work, the
seam is wrong; tell me before you change it.

**Screens, in this order:**
1. Opportunity list with score, top two flags and age
2. Opportunity detail: scorecard with expandable rationale, flags, the JD with matched requirements,
   questions to ask
3. Company profile: full report, evidence inline and expandable, gaps panel, run history
4. Run inspector: stage timeline, searches, sources, tokens, cost

**The one interface problem worth real effort:** a research run takes about four minutes. Stream
stage-level progress so each section fills in as it completes, and make the finished sections
readable while later stages are still running. A silent spinner for four minutes is the failure mode
to design against.

Multi-tenancy: single user in practice, but put auth and RLS in now. It costs around two hours today
and saves a rewrite later.
