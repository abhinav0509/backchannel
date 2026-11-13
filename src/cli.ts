import 'dotenv/config'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { Command } from 'commander'
import { runResearch } from './pipeline/run.js'
import { toMarkdown, triageToMarkdown } from './report/markdown.js'
import { loadProfile } from './types/profile.js'
import type { Budget } from './util/cost.js'
import { slug } from './util/slug.js'

function summary(budget: Budget, ms: number): string {
  const rows = Object.entries(budget.stages).map(
    ([stage, s]) => `  ${stage.padEnd(11)} ${String(s.searches).padStart(3)} searches  ${String(s.input + s.cacheRead + s.cacheWrite).padStart(8)} in  ${String(s.output).padStart(7)} out  $${s.usd.toFixed(3)}`,
  )
  const t = budget.total
  return [`\nRun cost`, ...rows, `  ${'total'.padEnd(11)} ${String(t.searches).padStart(3)} searches  $${t.usd.toFixed(3)} in ${(ms / 1000).toFixed(1)}s`].join('\n')
}

function save(name: string, json: unknown, md: string): string {
  mkdirSync('out', { recursive: true })
  writeFileSync(`out/${name}.json`, JSON.stringify(json, null, 2))
  writeFileSync(`out/${name}.md`, md)
  return `out/${name}.md`
}

const program = new Command('backchannel')

program
  .command('research')
  .description('research the company behind a recruiter email or job description')
  .option('--file <path>', 'read the text from a file')
  .option('--text <text>', 'pass the text directly')
  .option('--deep', 'run the full research (default is the quick triage check)')
  .option('--company-domain <domain>', 'skip disambiguation: the company is the one at this domain')
  .option('--fresh', 'ignore cached API responses')
  .action(async (o: { file?: string; text?: string; deep?: boolean; companyDomain?: string; fresh?: boolean }) => {
    const text = o.file ? readFileSync(o.file, 'utf8') : o.text
    if (!text?.trim()) return program.error('give --file or --text')
    if (o.fresh) process.env.BACKCHANNEL_FRESH = '1'
    const profile = loadProfile()
    if (!profile) console.log('No profile.json found: role fit will be marked unknown. Copy profile.example.json to start one.')
    let companyDomain = o.companyDomain?.toLowerCase()

    for (;;) {
      const started = Date.now()
      const outcome = await runResearch({ text, mode: o.deep ? 'deep' : 'triage', profile, companyDomain })
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

      if (outcome.kind === 'triage') {
        const r = outcome.result
        const file = save(`${slug(r.identity.display_name, r.role.title)}.triage`, r, triageToMarkdown(r))
        console.log(`\n${r.deep_dive.recommended ? 'Worth a deep dive' : 'Probably not worth a deep dive'}: ${r.deep_dive.reason}`)
        console.log(`Saved ${file}. Run again with --deep for the full report.`)
      } else {
        const r = outcome.report
        const file = save(slug(r.identity.display_name, r.role.title), r, toMarkdown(r))
        console.log(`\n${r.verdict}\n\nSaved ${file}${r.partial ? ' (partial)' : ''}.`)
      }
      return
    }
  })

await program.parseAsync()
