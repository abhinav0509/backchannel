import { runResearch, message } from '../pipeline/run'
import type { Candidate } from '../pipeline/stage1-resolve'
import { loadProfile } from '../types/profile'
import type { CompanyResearch, TriageResult } from '../types/research'
import { beginRun, finishRun, getOpportunity, getProfile, recordEvent } from './repo'

export type Outcome =
  | { kind: 'report'; report: CompanyResearch }
  | { kind: 'triage'; result: TriageResult }
  | { kind: 'needs_choice'; reason: string; candidates: Candidate[] }
  | { kind: 'failed'; error: string }

/** Writes how a run ended. Shared by the in-process runner (CLI) and the durable workflow (web). */
export async function applyOutcome(owner: string, oppId: string, runId: string, o: Outcome): Promise<void> {
  switch (o.kind) {
    case 'failed':
      return finishRun(owner, oppId, runId, { status: 'failed', error: o.error })
    case 'needs_choice':
      return finishRun(owner, oppId, runId, { status: 'needs_choice', candidates: o.candidates, choice_reason: o.reason })
    case 'triage':
    case 'report': {
      const r = o.kind === 'triage' ? o.result : o.report
      return finishRun(owner, oppId, runId, {
        status: 'done',
        candidates: [],
        choice_reason: null,
        domain: r.identity.domain,
        company: r.identity.display_name,
        ...(o.kind === 'triage' ? { triage: o.result } : { report: o.report }),
      })
    }
  }
}

/** The candidate profile: the one saved in the app, else a local profile.json (CLI). */
export async function profileFor(owner: string) {
  return (await getProfile(owner)) ?? loadProfile()
}

/** Runs research inside this process (the CLI). The web app uses the durable workflow instead. */
export async function runInProcess(owner: string, oppId: string, opts: { mode: 'triage' | 'deep'; companyDomain?: string }): Promise<void> {
  const o = await getOpportunity(owner, oppId)
  if (!o) throw new Error(`no opportunity ${oppId}`)
  const runId = await beginRun(owner, oppId, opts.mode)
  try {
    const outcome = await runResearch({
      text: o.text,
      mode: opts.mode,
      profile: await profileFor(owner),
      companyDomain: opts.companyDomain ?? o.domain ?? undefined,
      runId,
      onEvent: (e) => recordEvent(owner, oppId, runId, e),
    })
    await applyOutcome(owner, oppId, runId, outcome.kind === 'needs_choice' ? { kind: 'needs_choice', reason: outcome.reason, candidates: outcome.candidates } : outcome)
  } catch (e) {
    await applyOutcome(owner, oppId, runId, { kind: 'failed', error: message(e) })
  }
}
