import { existsSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import 'dotenv/config'
import { runResearch } from '../src/pipeline/run'
import { CompanyResearch } from '../src/types/research'
import { check, get } from './assert'
import { fixtures } from './fixtures/index'

// --only lets you re-run one company: every full eval run costs real money against the monthly cap.
const { values } = parseArgs({ options: { only: { type: 'string' } } })
const selected = values.only ? fixtures.filter((f) => f.name === values.only) : fixtures
if (selected.length === 0) {
  console.error(`no fixture named ${values.only}; have: ${fixtures.map((f) => f.name).join(', ')}`)
  process.exit(2)
}

let passed = 0
for (const f of selected) {
  const inputPath = new URL(`./fixtures/inputs/${f.input}`, import.meta.url)
  if (!f.checked || !existsSync(inputPath) || Object.keys(f.expect).length === 0) {
    console.log(`NOT READY  ${f.name}: needs hand-checked ground truth and an input file (${f.tests})`)
    continue
  }

  let target: unknown
  let cost = ''
  try {
    const outcome = await runResearch({ text: readFileSync(inputPath, 'utf8'), mode: 'deep', profile: null })
    if (outcome.kind !== f.outcome) throw new Error(`expected outcome ${f.outcome}, got ${outcome.kind}`)
    if (outcome.kind === 'report') {
      target = CompanyResearch.parse(outcome.report)
      cost = ` ($${outcome.report.run.cost_usd.toFixed(2)})`
    } else {
      target = outcome
      cost = ` ($${outcome.budget.total.usd.toFixed(2)})`
    }
  } catch (err) {
    console.log(`FAIL       ${f.name}: ${err instanceof Error ? err.message : String(err)}`)
    continue
  }

  const failures = Object.entries(f.expect)
    .map(([path, exp]) => [path, check(get(target, path), exp)] as const)
    .filter(([, msg]) => msg !== null)
  if (failures.length === 0) {
    passed++
    console.log(`PASS       ${f.name}${cost}`)
  } else {
    console.log(`FAIL       ${f.name}${cost}`)
    for (const [path, msg] of failures) console.log(`             ${path}: ${msg}`)
  }
}

console.log(`\n${passed}/${selected.length} passed`)
process.exit(passed === selected.length ? 0 : 1)
