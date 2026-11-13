import type { FlagKind, ScoreDimension, StageName } from '../../src/types/research'

export function age(iso: string, now = new Date()): string {
  const then = new Date(iso)
  const s = (now.getTime() - then.getTime()) / 1000
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86400000)
  if (days === 0) return `${Math.floor(s / 3600)} h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

export const usd = (n: number) => (n > 0 && n < 0.005 ? '<$0.01' : `$${n.toFixed(2)}`)

const FLAGS: Record<FlagKind, string> = {
  layoff_history: 'Layoff history',
  pe_ownership: 'Private equity owner',
  leadership_churn: 'Leadership churn',
  sentiment_decline: 'Employee sentiment falling',
  cost_centre_risk: 'Local office is a cost centre',
  site_immaturity: 'Local office is new',
  role_ambiguity: 'Role is unclear',
  level_mismatch: 'Level mismatch',
  funding_risk: 'Funding risk',
  market_commoditisation: 'Product being commoditised',
  attrition_signal: 'Role keeps being reposted',
  rto_change: 'Office policy tightened',
  site_growth: 'Local office growing',
  profitable: 'Profitable',
  category_leader: 'Category leader',
  durable_moat: 'Durable advantage',
  rare_role: 'Rare role',
  product_charter: 'Owns real product',
  domain_fit: 'Fits your interests',
  design_maturity: 'Mature design practice',
  public_comp_band: 'Pay band is public',
  tenure_signal: 'People stay',
}
export const flagLabel = (k: FlagKind) => FLAGS[k]

const DIMENSIONS: Record<ScoreDimension, string> = {
  role_fit: 'Role fit',
  company_health: 'Company health',
  job_security: 'Job security',
  career_signal: 'Career signal',
  culture: 'Culture',
  comp_confidence: 'Pay clarity',
}
export const dimensionLabel = (d: ScoreDimension) => DIMENSIONS[d]
export const DIMENSION_ORDER = Object.keys(DIMENSIONS) as ScoreDimension[]

const OWNERSHIP: Record<string, string> = {
  public: 'Publicly listed',
  pe_backed: 'Private equity backed',
  vc_backed: 'Venture backed',
  bootstrapped: 'Bootstrapped',
  subsidiary: 'Subsidiary',
  unknown: 'Unknown',
}
export const ownershipLabel = (o: string) => OWNERSHIP[o] ?? o

const STAGES: Partial<Record<StageName, string>> = {
  parse: 'Reading the email',
  resolve: 'Identifying the company',
  triage: 'Quick check for red flags',
  money: 'Ownership and money',
  people: 'People and leadership',
  synthesize: 'Weighing it up',
}
export const stageLabel = (s: StageName) => STAGES[s] ?? s

export const stagesFor = (mode: 'triage' | 'deep'): StageName[] =>
  mode === 'triage' ? ['parse', 'resolve', 'triage'] : ['parse', 'resolve', 'money', 'people', 'synthesize']

/** First sentence and the rest. A sentence ends at . ! or ? followed by a space and a capital letter. */
export function splitLead(text: string): [string, string] {
  const m = text.match(/^(.+?[.!?])\s+(?=[A-Z])(?<![A-Z]\.[A-Z]\.\s)(.*)$/s)
  return m ? [m[1]!.trim(), m[2]!.trim()] : [text.trim(), ''] // non-null: both groups always match when m does
}

/** Display-only: quotes are stored verbatim, but page markdown (#, **, links, bullets) reads as noise. */
export const cleanQuote = (q: string) =>
  q
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(#{1,6}|[-*•])\s+/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
