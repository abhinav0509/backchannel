import { ESTIMATE_USD } from '../config'
import { message } from '../pipeline/run'
import { synthesize } from '../pipeline/stage8-synthesize'
import * as repo from '../store/repo'
import { allowance, runBudget } from '../util/cost'
import type { Reply } from './api'

const reply = (status: number, body: unknown): Reply => ({ status, body })

/**
 * Re-judges a finished report against the person's current profile: new scores, flags, verdict,
 * questions and how-you-fit, on the same research. One synthesis call, about $0.40, against a
 * full re-run's $2.10. The cost is charged to the research run it re-judges, so the report's cost stays whole.
 */
export async function refit(owner: string, oppId: string): Promise<Reply> {
  const o = await repo.getOpportunity(owner, oppId)
  if (!o) return reply(404, { error: 'No opportunity with that id.' })
  if (!o.report) return reply(409, { error: 'Run full research first; a quick check has nothing to match against.' })
  if (o.status === 'running') return reply(409, { error: 'Research is running. Refresh once it finishes.' })
  const profile = await repo.getProfile(owner)
  if (!profile) return reply(409, { error: 'Add your CV first, so there is a profile to match against.' })
  const left = await allowance(owner)
  if (left.remainingUsd < ESTIMATE_USD.refit)
    return reply(402, { error: `Refreshing needs about $${ESTIMATE_USD.refit.toFixed(2)}, and there is $${left.remainingUsd.toFixed(2)} left this month.` })

  const run = [...o.runs].reverse().find((r) => r.mode === 'deep' && r.status === 'done')
  const { flags: _f, scores: _s, questions_to_ask: _q, questions: _qs, verdict: _v, outlook: _o, fit: _fit, ...draft } = o.report
  let out
  try {
    out = (await synthesize({ draft, profile }, await runBudget('deep', run?.id ?? null))).data
  } catch (e) {
    return reply(502, { error: `The refresh did not complete: ${message(e)}. Your report is unchanged.` })
  }
  // shortcut: earlier synthesis gaps cannot be told apart from research gaps in a stored report, so
  // the new ones lead and exact repeats are dropped. Store them apart if near-duplicates start to show.
  const report = {
    ...o.report,
    flags: out.flags,
    scores: out.scores,
    questions: out.questions,
    questions_to_ask: out.questions.map((q) => q.question),
    verdict: out.verdict,
    outlook: out.outlook,
    fit: out.fit,
    gaps: [...new Set([...out.gaps, ...o.report.gaps])],
  }
  await repo.patchOpportunity(owner, oppId, { report })
  return reply(200, await repo.getOpportunity(owner, oppId))
}
