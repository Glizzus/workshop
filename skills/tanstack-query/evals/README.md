# tanstack-query skill: evals

For maintainers. None of this ships: only `dist/` (a copy of `skill/`) is
published. Paths below are relative to this folder.

| Folder / file | What it checks | How to run |
|---|---|---|
| `reference-app/` | the skill's templates and every non-trivial snippet in the references still type-check, lint and pass their 23 tests | `cd reference-app && npm install && npx vue-tsc --noEmit && npx eslint . && npx vitest run` |
| `tasks/` | an agent with vs. without the skill, on 5 tasks graded by hidden tests | see "Running the task evals" |
| `triggers.json` | whether your agent loads the skill when it should | run each prompt in your agent, 3 times |

`reference-app/src` and `reference-app/test` hold copies of the skill's
templates plus `src/examples/` (the reference snippets). After editing a
template, copy it in and re-run: `cp -r ../skill/templates/. reference-app/`.

## Running the task evals

Each task has a starting app, a prompt, hidden tests the agent never sees, and a reference solution.

| Task | Tests whether the agent... |
|---|---|
| `t1-detail-route` | adds a detail page whose query follows the route param and shows 404s as errors |
| `t2-create-todo` | adds a mutation that refreshes the list and reports failures |
| `t3-refactor-projects` | replaces onMounted/watch/manual refs with a query |
| `t4-job-polling` | polls until done, then stops, and stops after leaving the page |
| `t5-write-tests` | writes tests that catch 3 planted bugs (frozen query key, API client not throwing, cache not updated) |

Two prompt styles per task: `prompt.md` spells out every requirement; `prompt-natural.md` is how a user would ask, without hints.

```bash
# 1. a fresh app (needs a node_modules with the reference-app's dependencies)
node tasks/prepare.mjs t1-detail-route /tmp/run1 --node-modules reference-app/node_modules --variant natural [--skill ../skill]
# 2. run your agent in /tmp/run1 with the printed prompt
# 3. grade: type-check, ESLint, then hidden tests (or, for t5, the agent's tests against each planted bug)
node tasks/grade.mjs t1-detail-route /tmp/run1 --variant natural
```

`--skill` copies the skill to `.agents/skills/tanstack-query/` in the app. Tell your agent about it the way your harness normally lists skills.

Run each task at least 3 times per condition (with and without `--skill`) on
the models you actually use. One run per cell can't tell a real difference
from luck.

## What is known so far

An earlier round used Claude Haiku 4.5 as a stand-in for a weaker model, one
run per cell, partly on an older draft of the skill. Every task was solved with
and without the skill: these tasks are too easy to show a difference for that
model. The skill did change habits (agents left their tests in the project and
moved endpoints onto an API client that throws on errors), but one run each is
not evidence. Those results were dropped.

Next: run the tasks on the real target models. If they also pass everything,
add harder tasks (a larger existing codebase, v4 code to migrate, a vague bug
report).
