import { z } from 'zod'

// "2023", "2023-04" or "2023-04-17": sources often give only a year or month.
export const PartialDate = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'expected YYYY, YYYY-MM or YYYY-MM-DD')

export const Confidence = z.enum(['confirmed', 'reported', 'unverified'])
export const TrustTier = z.enum(['primary', 'secondary', 'tertiary'])

export const EvidenceRef = z.object({
  url: z.url(),
  title: z.string(),
  publisher: z.string().nullable(),
  published_at: PartialDate.nullable(),
  retrieved_at: z.iso.datetime(),
  snippet: z.string().min(1).max(300),
  trust_tier: TrustTier,
})

/** Nothing factual exists outside this wrapper. */
export const claim = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    confidence: Confidence,
    evidence: z.array(EvidenceRef).min(1, 'a claim needs at least one evidence reference'),
    as_of: PartialDate.nullable(),
    // Optional, not nullable: nullable would push the resolve schema past the API's grammar limit.
    // Unconstrained output that writes note: null is read as no note (llm/evidence.ts).
    note: z.string().optional(),
  })
export type Claim<T> = z.infer<ReturnType<typeof claim<z.ZodType<T>>>>

export const FundingEvent = z.object({
  date: PartialDate.nullable(),
  round: z.string().nullable(),
  // As reported, never converted: a converted figure is a number we made up.
  amount: z.number().nonnegative().nullable(),
  currency: z.string().length(3).nullable(), // ISO 4217
  investors: z.array(z.string()),
})

export const LayoffEvent = z.object({
  date: PartialDate.nullable(),
  headcount: z.int().positive().nullable(),
  percentage: z.number().gt(0).max(100).nullable(), // 0-100, not 0-1
  scope: z.string().nullable(),
  handling_notes: z.string().nullable(),
})

export const LeadershipChange = z.object({
  date: PartialDate.nullable(),
  role: z.string(),
  person_in: z.string().nullable(),
  person_out: z.string().nullable(),
  direction: z.enum(['appointment', 'departure', 'transition']),
})

export const ReviewScore = z.object({
  source: z.string(),
  score: z.number().nonnegative(),
  scale: z.number().positive(),
  sample_size: z.int().nonnegative().nullable(),
  trend: z.enum(['rising', 'flat', 'falling', 'unknown']),
  as_of: PartialDate.nullable(),
}).refine((r) => r.score <= r.scale, 'score exceeds scale')

// PRD section 5.3: the first twelve are risk flags, the rest green flags.
export const RISK_KINDS = [
  'layoff_history', 'pe_ownership', 'leadership_churn', 'sentiment_decline',
  'cost_centre_risk', 'site_immaturity', 'role_ambiguity', 'level_mismatch',
  'funding_risk', 'market_commoditisation', 'attrition_signal', 'rto_change',
] as const
export const GREEN_KINDS = [
  'site_growth', 'profitable', 'category_leader', 'durable_moat',
  'rare_role', 'product_charter', 'domain_fit', 'design_maturity',
  'public_comp_band', 'tenure_signal',
] as const
export const FlagKind = z.enum([...RISK_KINDS, ...GREEN_KINDS])

export const Flag = z.object({
  kind: FlagKind,
  polarity: z.enum(['risk', 'green']),
  severity: z.int().min(1).max(5),
  title: z.string(),
  detail: z.string(),
  // 'profile' = judged from the JD against the candidate profile, so there is no web source to cite.
  basis: z.enum(['web', 'profile']),
  evidence: z.array(EvidenceRef),
})
  .refine((f) => f.basis === 'profile' || f.evidence.length > 0, {
    message: 'a web-based flag needs at least one evidence reference',
    path: ['evidence'],
  })
  .refine((f) => (f.polarity === 'risk') === (RISK_KINDS as readonly string[]).includes(f.kind), {
    message: `polarity must match the kind: risk kinds are ${RISK_KINDS.join(', ')}; the others are green. Leave a flag out rather than invert a kind (for example, do not use pe_ownership to say "not PE owned").`,
    path: ['polarity'],
  })

export const ScoreDimension = z.enum([
  'role_fit', 'company_health', 'job_security', 'career_signal', 'culture', 'comp_confidence',
])

export const Score = z.object({
  dimension: ScoreDimension,
  value: z.number().min(0).max(100),
  rationale: z.string(),
  evidence_urls: z.array(z.url()),
  unknown: z.boolean(), // true when there was not enough to judge; value is then ignored
})

export const StageName = z.enum([
  'parse', 'resolve', 'triage', 'business', 'money', 'people', 'market', 'contacts', 'local', 'role', 'synthesize',
])

export const Domain = z.string().regex(/^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/, 'bare lowercase domain, e.g. sonatype.com')

// Which company this is (domain, confidence) gates the run; the facts about it may be unsourced
// (null, with the reason in gaps) without blocking research on a company we have identified.
export const Identity = z.object({
  legal_name: claim(z.string()).nullable(),
  display_name: z.string(),
  domain: Domain,
  hq: claim(z.string()).nullable(),
  founded_year: claim(z.int().min(1600).max(2100)).nullable(),
  is_public: claim(z.boolean()).nullable(),
  resolution_confidence: z.number().min(0).max(1),
})

export const Role = z.object({
  title: z.string(),
  level_claimed: z.string().nullable(),
  location: z.string().nullable(),
  work_policy: z.enum(['onsite', 'hybrid', 'remote', 'unknown']),
  employment_type: z.enum(['permanent', 'contract', 'rotation', 'unknown']),
  required_years: z.string().nullable(),
  extracted_requirements: z.array(z.string()),
})

export const Person = z.object({
  name: z.string(),
  role: z.string(),
  background: z.string().nullable(), // as a source describes it: prior companies, expertise
  since: PartialDate.nullable(),
})

/** What the company does and who runs it (the business stage). */
export const Business = z.object({
  summary: claim(z.string()).nullable(), // what they do, in plain words
  products: z.array(claim(z.object({ name: z.string(), description: z.string() }))),
  customers: claim(z.string()).nullable(), // who pays
  business_model: claim(z.string()).nullable(),
  competitors: z.array(claim(z.string())),
  founders: z.array(claim(Person.extend({ still_involved: z.boolean().nullable() }))),
  leaders: z.array(claim(Person)), // current executives, and heads of product, design and engineering
})

// How central AI is to the company, as its own products and statements show it.
export const AiStance = z.enum(['ai_native', 'ai_core', 'ai_adopting', 'ai_peripheral', 'none'])

/** Where it stands on AI and where it is heading (the market stage). */
export const Market = z.object({
  ai_stance: claim(AiStance).nullable(),
  ai_summary: claim(z.string()).nullable(),
  ai_initiatives: z.array(claim(z.object({ title: z.string(), detail: z.string(), date: PartialDate.nullable() }))),
  strategy: claim(z.string()).nullable(), // direction the company itself states
  recent_news: z.array(claim(z.object({ date: PartialDate.nullable(), headline: z.string() }))),
  tailwinds: z.array(claim(z.string())),
  headwinds: z.array(claim(z.string())),
})

/** How someone relates to the role you are considering. */
export const ContactRelation = z.enum(['hiring_manager', 'leadership_above_role', 'recruiter', 'team'])

/**
 * Someone worth knowing for this role, from public search results only. Work information only.
 * Their profile link, when there is one, is a LinkedIn URL among the claim's evidence: a search
 * result, never a page we opened.
 */
export const Contact = z.object({
  name: z.string(),
  title: z.string().nullable(),
  relation: ContactRelation,
  // confirmed: a source names this person with this company and a current title; possible: anything less.
  match: z.enum(['confirmed', 'possible']),
  why: z.string(), // why this person matters to the candidate
})

export const QuestionTopic = z.enum(['role', 'team', 'company', 'money', 'future', 'ai', 'culture', 'comp'])

/** An interview question, why it is worth asking, and what it is about. */
export const Question = z.object({
  question: z.string().min(1),
  why: z.string().min(1), // the finding or gap behind it
  topic: QuestionTopic,
})

export const StageStatus = z.enum(['ok', 'partial', 'failed'])

export const Run = z.object({
  mode: z.enum(['triage', 'deep']),
  searches_used: z.int().nonnegative(),
  input_tokens: z.int().nonnegative(),
  output_tokens: z.int().nonnegative(),
  cost_usd: z.number().nonnegative(),
  duration_ms: z.int().nonnegative(),
  stage_status: z.partialRecord(StageName, StageStatus),
})

export const CompanyResearch = z.object({
  schema_version: z.literal(2),
  generated_at: z.iso.datetime(),
  partial: z.boolean(), // true if a budget was hit or a stage failed

  identity: Identity,

  money: z.object({
    // null when no source established it; the reason goes in gaps.
    ownership_type: claim(z.enum(['public', 'pe_backed', 'vc_backed', 'bootstrapped', 'subsidiary', 'unknown'])).nullable(),
    funding_events: z.array(claim(FundingEvent)),
    revenue_signal: claim(z.string()).nullable(),
    profitability: claim(z.string()).nullable(),
    exit_activity: z.array(claim(z.string())),
  }),

  people: z.object({
    headcount: claim(z.int().positive()).nullable(),
    headcount_trend: claim(z.array(z.object({ year: z.int(), count: z.int().nonnegative() }))).nullable(),
    layoff_events: z.array(claim(LayoffEvent)),
    leadership_changes: z.array(claim(LeadershipChange)),
    review_scores: z.array(claim(ReviewScore)),
  }),

  // Reports from before these stages existed read back as null and [].
  business: Business.nullable().default(null),
  market: Market.nullable().default(null),
  contacts: z.array(claim(Contact)).max(6).nullable().default(null),

  role: Role,
  flags: z.array(Flag),
  scores: z.array(Score),
  questions_to_ask: z.array(z.string()).max(12), // the question text, kept for exports and older reports
  questions: z.array(Question).max(12).default([]),
  verdict: z.string(),
  outlook: z.string().nullable().default(null), // synthesis's read on where the company is heading, labelled as a read
  gaps: z.array(z.string()),
  run: Run,
})

/** One progress update from a run, for live UI. */
export const RunEvent = z.object({
  stage: StageName,
  status: z.union([z.literal('started'), StageStatus]),
  at: z.iso.datetime(),
  output: z.unknown().optional(),
  error: z.string().optional(),
})

/** The cheap first pass run on every email: is this worth a deep run? */
export const TriageResult = z.object({
  schema_version: z.literal(2),
  generated_at: z.iso.datetime(),
  partial: z.boolean(),
  identity: Identity,
  role: Role,
  flags: z.array(Flag),
  deep_dive: z.object({ recommended: z.boolean(), reason: z.string() }),
  gaps: z.array(z.string()),
  run: Run,
})

export type EvidenceRef = z.infer<typeof EvidenceRef>
export type Business = z.infer<typeof Business>
export type Market = z.infer<typeof Market>
export type Question = z.infer<typeof Question>
export type Contact = z.infer<typeof Contact>
export type ContactRelation = z.infer<typeof ContactRelation>
export type QuestionTopic = z.infer<typeof QuestionTopic>
export type AiStance = z.infer<typeof AiStance>
export type FundingEvent = z.infer<typeof FundingEvent>
export type LayoffEvent = z.infer<typeof LayoffEvent>
export type LeadershipChange = z.infer<typeof LeadershipChange>
export type ReviewScore = z.infer<typeof ReviewScore>
export type FlagKind = z.infer<typeof FlagKind>
export type Flag = z.infer<typeof Flag>
export type Score = z.infer<typeof Score>
export type ScoreDimension = z.infer<typeof ScoreDimension>
export type StageName = z.infer<typeof StageName>
export type StageStatus = z.infer<typeof StageStatus>
export type CompanyResearch = z.infer<typeof CompanyResearch>
export type TriageResult = z.infer<typeof TriageResult>
export type RunEvent = z.infer<typeof RunEvent>
