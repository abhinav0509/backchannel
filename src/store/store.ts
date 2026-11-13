import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { Candidate } from '../pipeline/stage1-resolve.js'
import { log } from '../util/log.js'
import { CompanyResearch, RunEvent, StageName, TriageResult } from '../types/research.js'

// shortcut: JSON files on local disk, one per opportunity. Swap for Supabase (PRD section 10)
// when this needs to run hosted or for more than one person; the functions below are the seam.

export const RunRecord = z.object({
  id: z.string(),
  mode: z.enum(['triage', 'deep']),
  started_at: z.iso.datetime(),
  finished_at: z.iso.datetime().nullable(),
  status: z.enum(['running', 'needs_choice', 'done', 'failed']),
  cost_usd: z.number(),
  searches: z.int(),
  input_tokens: z.int(),
  output_tokens: z.int(),
  stages: z.partialRecord(StageName, z.object({ usd: z.number(), searches: z.int(), input: z.int(), output: z.int() })),
  error: z.string().nullable(),
})
export type RunRecord = z.infer<typeof RunRecord>

export const Opportunity = z.object({
  id: z.string(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  text: z.string(),
  company: z.string().nullable(),
  role: z.string().nullable(),
  domain: z.string().nullable(),
  status: z.enum(['idle', 'running', 'needs_choice', 'done', 'failed']),
  runner_pid: z.int().nullable().default(null), // the process running research: the web server or a CLI
  candidates: z.array(Candidate),
  choice_reason: z.string().nullable(),
  error: z.string().nullable(),
  events: z.array(RunEvent), // the current or most recent run
  triage: TriageResult.nullable(),
  report: CompanyResearch.nullable(),
  runs: z.array(RunRecord),
})
export type Opportunity = z.infer<typeof Opportunity>

const dir = () => join(process.env.BACKCHANNEL_DATA_DIR ?? 'data', 'opportunities')
const SAFE_ID = /^[a-z0-9]{10,32}$/
const file = (id: string) => join(dir(), `${id}.json`)

function write(o: Opportunity): Opportunity {
  const valid = Opportunity.parse(o)
  mkdirSync(dir(), { recursive: true })
  const tmp = `${file(valid.id)}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(valid, null, 2))
  renameSync(tmp, file(valid.id)) // atomic replace: a reader never sees half a file
  return valid
}

export function createOpportunity(text: string): Opportunity {
  if (!text.trim()) throw new Error('the pasted text is empty')
  const now = new Date().toISOString()
  return write({
    id: randomBytes(8).toString('hex'),
    created_at: now,
    updated_at: now,
    text: text.trim(),
    company: null,
    role: null,
    domain: null,
    status: 'idle',
    runner_pid: null,
    candidates: [],
    choice_reason: null,
    error: null,
    events: [],
    triage: null,
    report: null,
    runs: [],
  })
}

export function getOpportunity(id: string): Opportunity | null {
  if (!SAFE_ID.test(id) || !existsSync(file(id))) return null
  return Opportunity.parse(JSON.parse(readFileSync(file(id), 'utf8')))
}

export function listOpportunities(): Opportunity[] {
  if (!existsSync(dir())) return []
  return readdirSync(dir())
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      try {
        return getOpportunity(f.slice(0, -5)) ?? []
      } catch (e) {
        log('store_unreadable', { file: f, error: e instanceof Error ? e.message.slice(0, 300) : String(e) })
        return []
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function updateOpportunity(id: string, fn: (o: Opportunity) => Opportunity): Opportunity {
  const o = getOpportunity(id)
  if (!o) throw new Error(`no opportunity ${id}`)
  return write({ ...fn(o), id, updated_at: new Date().toISOString() })
}
