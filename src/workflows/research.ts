// Workflow code runs in a sandbox without Node.js: import only steps and types here.
import type { StageResult } from '../pipeline/run'
import { finishStep, parseStep, researchStep, resolveStep, synthStep, type Ctx } from './steps'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export type { Ctx }

// After its retries, a stage that still throws becomes a failed stage: the report degrades, the run goes on.
const failed = (e: unknown): StageResult<never> => ({ data: null, dropped: [], searchCapped: false, error: message(e) })

/**
 * One research run as a durable workflow: each stage is a separate, retried step, so a run
 * survives function timeouts and redeploys. Orchestration only; all work happens in steps.
 */
export async function researchWorkflow(c: Ctx): Promise<void> {
  "use workflow"
  try {
    const parsed = await parseStep(c)
    const gate = await resolveStep(c, parsed)
    if (gate.kind === 'mismatch') return await finishStep(c, { kind: 'failed', error: gate.message })
    if (gate.kind === 'ask') return await finishStep(c, { kind: 'ask', gate })

    if (c.mode === 'triage') {
      const t = await researchStep(c, 'triage', gate.identity).catch(failed)
      return await finishStep(c, { kind: 'triage', parsed, gate, triage: t })
    }

    const [business, money, people, market, contacts] = await Promise.all([
      researchStep(c, 'business', gate.identity).catch(failed),
      researchStep(c, 'money', gate.identity).catch(failed),
      researchStep(c, 'people', gate.identity).catch(failed),
      researchStep(c, 'market', gate.identity).catch(failed),
      // Mirrors contactsInput in pipeline/run (workflow code may import only steps and types): role and recruiter name, never the email.
      researchStep(c, 'contacts', {
        ...gate.identity,
        role: parsed.role,
        recruiter: parsed.recruiter.name ? { name: parsed.recruiter.name, agency: parsed.recruiter.agency } : null,
      }).catch(failed),
    ])
    const { draft, synth } = await synthStep(c, parsed, gate, { business, money, people, market, contacts })
    await finishStep(c, { kind: 'report', draft, synth })
  } catch (e) {
    await finishStep(c, { kind: 'failed', error: message(e) })
  }
}
