import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { Command } from 'commander'
import { runResearch } from './pipeline/run.js'
import type { Budget } from './util/cost.js'

function summary(budget: Budget, ms: number): string {
  const rows = Object.entries(budget.stages).map(
    ([stage, s]) => `  ${stage.padEnd(11)} ${String(s.searches).padStart(3)} searches  ${String(s.input + s.cacheRead + s.cacheWrite).padStart(8)} in  ${String(s.output).padStart(7)} out  $${s.usd.toFixed(3)}`,
  )
  const t = budget.total
  return [`\nRun cost`, ...rows, `  ${'total'.padEnd(11)} ${String(t.searches).padStart(3)} searches  $${t.usd.toFixed(3)} in ${(ms / 1000).toFixed(1)}s`].join('\n')
}

const program = new Command('backchannel')

program
  .command('research')
  .description('research the company behind a recruiter email or job description')
  .option('--file <path>', 'read the text from a file')
  .option('--text <text>', 'pass the text directly')
  .option('--company-domain <domain>', 'skip disambiguation: the company is the one at this domain')
  .action(async (o: { file?: string; text?: string; companyDomain?: string }) => {
    const text = o.file ? readFileSync(o.file, 'utf8') : o.text
    if (!text?.trim()) return program.error('give --file or --text')
    let companyDomain = o.companyDomain?.toLowerCase()

    for (;;) {
      const started = Date.now()
      const outcome = await runResearch({ text, companyDomain })
      console.log(summary(outcome.budget, Date.now() - started))

      if (outcome.kind === 'needs_choice') {
        console.log(`\nStopped before researching: ${outcome.reason}.`)
        if (outcome.gaps.length) console.log(`Gaps:\n  ${outcome.gaps.join('\n  ')}`)
        console.log('\nCandidates:')
        outcome.candidates.forEach((c, i) => console.log(`  ${i + 1}. ${c.name} (${c.domain}), confidence ${c.confidence.toFixed(2)}: ${c.reason}`))
        if (!process.stdin.isTTY || outcome.candidates.length === 0) {
          console.log('\nRe-run with --company-domain <domain> to choose.')
          process.exitCode = 3
          return
        }
        const rl = createInterface({ input: process.stdin, output: process.stdout })
        const answer = await rl.question('\nPick a number, or type a domain (blank to stop): ')
        rl.close()
        const picked = outcome.candidates[Number(answer) - 1]?.domain ?? answer.trim().toLowerCase()
        if (!picked) return
        companyDomain = picked
        continue
      }

      if (outcome.kind === 'resolved') {
        const id = outcome.resolved.identity
        console.log(`\nResolved: ${id?.display_name} (${id?.domain}), confidence ${id?.resolution_confidence}`)
        console.log(JSON.stringify(outcome.resolved, null, 2))
        if (outcome.dropped.length) console.log(`\nDropped:\n  ${outcome.dropped.join('\n  ')}`)
        console.log('\nStages 3, 4 and 8 are not built yet; the run stops after resolution.')
      }
      return
    }
  })

await program.parseAsync()
