import 'dotenv/config'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { Command } from 'commander'
import { toMarkdown, triageToMarkdown } from './report/markdown.js'
import { startRun } from './store/runner.js'
import { createOpportunity, getOpportunity, type RunRecord } from './store/store.js'
import { loadProfile } from './types/profile.js'
import { slug } from './util/slug.js'

function summary(r: RunRecord | undefined): string {
  if (!r) return ''
  const rows = Object.entries(r.stages).map(
    ([stage, s]) => `  ${stage.padEnd(11)} ${String(s?.searches ?? 0).padStart(3)} searches  ${String(s?.input ?? 0).padStart(8)} in  ${String(s?.output ?? 0).padStart(7)} out  $${(s?.usd ?? 0).toFixed(3)}`,
  )
  const secs = r.finished_at ? (new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000 : 0
  return [`\nRun cost`, ...rows, `  ${'total'.padEnd(11)} ${String(r.searches).padStart(3)} searches  $${r.cost_usd.toFixed(3)} in ${secs.toFixed(1)}s`].join('\n')
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
    if (!loadProfile()) console.log('No profile.json found: role fit will be marked unknown. Copy profile.example.json to start one.')

    // Saved to the same store as the web app, so terminal runs show up there too.
    const { id } = createOpportunity(text)
    const mode = o.deep ? 'deep' : 'triage'
    let companyDomain = o.companyDomain?.toLowerCase()

    for (;;) {
      await startRun(id, companyDomain ? { mode, companyDomain } : { mode })
      const opp = getOpportunity(id)! // non-null: created above and never deleted
      console.log(summary(opp.runs.at(-1)))

      if (opp.status === 'failed') {
        console.error(`\nResearch stopped: ${opp.error}`)
        process.exitCode = 1
        return
      }
      if (opp.status === 'needs_choice') {
        console.log(`\nStopped before researching: ${opp.choice_reason}.`)
        console.log('\nCandidates:')
        opp.candidates.forEach((c, i) => console.log(`  ${i + 1}. ${c.name} (${c.domain}), confidence ${c.confidence.toFixed(2)}: ${c.reason}`))
        if (!process.stdin.isTTY || opp.candidates.length === 0) {
          console.log('\nRe-run with --company-domain <domain>, or choose in the web app.')
          process.exitCode = 3
          return
        }
        const rl = createInterface({ input: process.stdin, output: process.stdout })
        const answer = await rl.question('\nPick a number, or type a domain (blank to stop): ')
        rl.close()
        const picked = opp.candidates[Number(answer) - 1]?.domain ?? answer.trim().toLowerCase()
        if (!picked) return
        companyDomain = picked
        continue
      }

      if (mode === 'triage' && opp.triage) {
        const r = opp.triage
        const file = save(`${slug(r.identity.display_name, r.role.title)}.triage`, r, triageToMarkdown(r))
        console.log(`\n${r.deep_dive.recommended ? 'Worth a deep dive' : 'Probably not worth a deep dive'}: ${r.deep_dive.reason}`)
        console.log(`Saved ${file}. Run again with --deep for the full report.`)
      } else if (opp.report) {
        const r = opp.report
        const file = save(slug(r.identity.display_name, r.role.title), r, toMarkdown(r))
        console.log(`\n${r.verdict}\n\nSaved ${file}${r.partial ? ' (partial)' : ''}.`)
      }
      return
    }
  })

await program.parseAsync()
