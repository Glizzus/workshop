// Grades one finished task run. Hidden tests are copied in only now, after the agent is done.
//   node grade.mjs <task-id> <app-dir>
// Prints a JSON report and writes it to <app-dir>/grade.json.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const [task, appArg] = process.argv.slice(2)
const app = path.resolve(appArg)
const variantFlag = process.argv.indexOf('--variant')
const variant = variantFlag === -1 ? 'explicit' : process.argv[variantFlag + 1] // explicit | natural
const hiddenDir = variant === 'natural' && fs.existsSync(path.join(here, task, 'hidden-natural')) ? 'hidden-natural' : 'hidden'

const run = (cmd, args, cwd = app, timeout = 300_000) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } })
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const report = { task, variant, app }

// --- static checks (before hidden files are added)
const tsc = run('npx', ['vue-tsc', '--noEmit'])
report.typecheckErrors = (tsc.out.match(/error TS\d+/g) ?? []).length

const eslint = run('npx', ['eslint', '.', '-f', 'json', '--ignore-pattern', '__hidden__/**', '--ignore-pattern', 'vitest.hidden.config.ts'])
try {
  const results = JSON.parse(eslint.out.slice(eslint.out.indexOf('[')))
  const messages = results.flatMap((r) => r.messages.filter((m) => m.severity === 2))
  report.eslintErrors = messages.length
  report.eslintQueryPluginErrors = messages.filter((m) => m.ruleId?.startsWith('@tanstack/query')).map((m) => m.ruleId)
} catch {
  report.eslintErrors = 'eslint failed to run'
}


// --- behavior
function vitestJson(args, cwd) {
  const outFile = path.join(os.tmpdir(), `vitest-${process.pid}-${Date.now()}.json`)
  const r = run('npx', ['vitest', 'run', ...args, '--reporter=json', `--outputFile=${outFile}`], cwd, 600_000)
  let tests = []
  try {
    const json = JSON.parse(fs.readFileSync(outFile, 'utf8'))
    tests = json.testResults.flatMap((f) => f.assertionResults.map((a) => ({ name: a.title, status: a.status })))
  } catch {
    // no JSON: config or collection failure
  }
  return { code: r.code, tests, tail: r.out.split('\n').slice(-15).join('\n') }
}

if (task === 't5-write-tests') {
  const own = vitestJson([], app)
  report.ownTests = { exitCode: own.code, passed: own.tests.filter((t) => t.status === 'passed').length, total: own.tests.length }
  if (own.code !== 0) report.ownTestsTail = own.tail
  const mutants = JSON.parse(fs.readFileSync(path.join(here, task, 'mutants.json'), 'utf8'))
  report.mutants = []
  // Mutants only count when the suite passes on the correct app; otherwise every mutant "fails" for free
  for (const mutant of own.code === 0 && own.tests.length > 0 ? mutants : []) {
    const copy = fs.mkdtempSync(path.join(os.tmpdir(), `mutant-${mutant.id}-`))
    fs.cpSync(app, copy, { recursive: true, filter: (src) => !src.includes(`${path.sep}node_modules`) })
    fs.symlinkSync(fs.realpathSync(path.join(app, 'node_modules')), path.join(copy, 'node_modules'), 'dir')
    const file = path.join(copy, mutant.file)
    const source = fs.readFileSync(file, 'utf8')
    if (!source.includes(mutant.find)) {
      report.mutants.push({ id: mutant.id, result: 'not applicable (source changed)' })
      continue
    }
    fs.writeFileSync(file, source.replace(mutant.find, mutant.replace))
    const result = vitestJson([], copy)
    report.mutants.push({ id: mutant.id, result: result.code !== 0 ? 'killed' : 'survived' })
    fs.rmSync(copy, { recursive: true, force: true })
  }
  report.mutantsKilled = report.mutants.filter((m) => m.result === 'killed').length
} else {
  const hidden = path.join(app, '__hidden__')
  fs.rmSync(hidden, { recursive: true, force: true })
  fs.cpSync(path.join(here, task, hiddenDir), hidden, { recursive: true })
  fs.cpSync(path.join(here, 'support'), path.join(hidden, 'support'), { recursive: true })
  fs.renameSync(path.join(hidden, 'support', 'vitest.hidden.config.ts'), path.join(app, 'vitest.hidden.config.ts'))
  const result = vitestJson(['--config', 'vitest.hidden.config.ts'], app)
  report.hiddenTests = result.tests
  report.hiddenPassed = `${result.tests.filter((t) => t.status === 'passed').length}/${result.tests.length}`
  if (result.tests.length === 0) report.hiddenTail = result.tail
  fs.rmSync(hidden, { recursive: true, force: true })
  fs.rmSync(path.join(app, 'vitest.hidden.config.ts'), { force: true })
}

if (task === 't3-refactor-projects') {
  const view = fs.readFileSync(path.join(app, 'src/views/ProjectsView.vue'), 'utf8')
  report.refactored = /useQuery/.test(view) && !/onMounted\s*\(/.test(view)
}

const json = JSON.stringify(report, null, 2)
fs.writeFileSync(path.join(app, 'grade.json'), json)
console.log(json)
