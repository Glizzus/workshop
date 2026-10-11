// Creates a fresh working copy of the eval app for one task.
//   node prepare.mjs <task-id> <dest-dir> --node-modules <dir> [--skill <path-to-tanstack-query-skill>] [--variant natural]
// Prompts: prompt.md spells out every requirement; prompt-natural.md is how a user would ask.
// With --skill, the skill is copied to <dest>/.agents/skills/tanstack-query (where skill-aware agents look).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const [task, dest] = process.argv.slice(2)
const flag = (name) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1]
}
const nodeModules = flag('--node-modules')
const skill = flag('--skill')
const variant = flag('--variant') ?? 'explicit' // explicit | natural
const promptFile = variant === 'natural' ? 'prompt-natural.md' : 'prompt.md'
if (!task || !dest || !nodeModules) {
  console.error('usage: node prepare.mjs <task-id> <dest-dir> --node-modules <dir> [--skill <dir>]')
  process.exit(2)
}
if (!fs.existsSync(path.join(here, task, 'prompt.md'))) {
  console.error(`unknown task: ${task}`)
  process.exit(2)
}

fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(path.join(here, 'base'), dest, { recursive: true })
const overlay = path.join(here, task, 'overlay')
if (fs.existsSync(overlay)) fs.cpSync(overlay, dest, { recursive: true })
fs.symlinkSync(path.resolve(nodeModules), path.join(dest, 'node_modules'), 'dir')
if (skill) fs.cpSync(skill, path.join(dest, '.agents', 'skills', 'tanstack-query'), { recursive: true })

console.log(`prepared ${task} in ${dest}${skill ? ' (with skill)' : ''}`)
console.log('--- prompt ---')
console.log(fs.readFileSync(path.join(here, task, promptFile), 'utf8'))
