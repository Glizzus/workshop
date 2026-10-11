# tanstack-query

An agent skill that writes, fixes, reviews and tests Vue 3 code that loads or
changes server data with TanStack Query (`@tanstack/vue-query` v5). It is
knowledge only: rules in `SKILL.md`, longer explanations in `references/`, and
working templates (API client, query factories, views, tests) to copy. No
scripts.

| Folder | What it is |
|---|---|
| `skill/` | `SKILL.md`, `references/` and `templates/`, copied into `dist/` as-is |
| `evals/` | for maintainers, never shipped: a reference app that verifies every template and snippet, task evals with hidden tests, trigger prompts and past results. See `evals/README.md` |

## Requirements

| | Version |
|---|---|
| @tanstack/vue-query | 5.102+ (the skill asks the user to upgrade from older 5.x) |
| Vue / Vue Router | 3.5+ / 4 or 5 |
| Node | 22.12+ (MSW 3) |
| TypeScript | 5.4+ |

Verified on: @tanstack/vue-query 5.104.1, Vue 3.5.43, Vue Router 5.4.0, MSW 3.0.3, Vitest 5.0.3, @testing-library/vue 8.1.0, ESLint 10 with @tanstack/eslint-plugin-query 5.104.1, TypeScript 6.0.

## Install

```sh
gh skill install glizzus/skills tanstack-query        # Copilot CLI
npx skills add glizzus/skills --skill tanstack-query  # other agents
```

### Add a pointer in AGENTS.md / CLAUDE.md

Agents often skip skills they would benefit from. In Vercel's evals the skill
was never invoked in 56% of runs until AGENTS.md told the agent to use it. Add
one line, with your path:

```
When a task loads or changes server data (API calls, useQuery, useMutation, or tests for them), read .agents/skills/tanstack-query/SKILL.md first and follow it.
```

### Keep your tools out of the skill folder

The skill ships example `.ts`/`.vue` files and tests. If the skill folder is
inside the project, exclude it:

- **ESLint:** add `'.agents/**', '.claude/**'` to `ignores` (`templates/eslint.config.mjs` already does).
- **Vitest:** set `test.include` to your own test folders (`templates/vite.config.ts` does); the default pattern also finds the skill's example tests.
- **TypeScript:** usually fine. If your tsconfig `include` is `**/*`, exclude the skill folder.

### Optional: wire up the tooling the skill uses

The skill's workflow runs three checks: a type-check, ESLint with
`@tanstack/eslint-plugin-query`, and Vitest.

If the project doesn't have ESLint or tests yet, the skill tells the agent to
set them up from its templates. Set them up once yourself if you'd rather
review that change separately:

```sh
npm i -D eslint typescript-eslint eslint-plugin-vue @tanstack/eslint-plugin-query
npm i -D vitest jsdom msw @testing-library/vue @testing-library/user-event @testing-library/jest-dom @vue/test-utils
```

Then copy `templates/eslint.config.mjs`, the `test` block of
`templates/vite.config.ts`, plus `templates/test/setup.ts`, `test/mocks/` and
`test/query-test-utils.ts`.

## Maintaining it

- **New TanStack Query minor version:** read the vue-query and query-core changelogs.
  - Update `skill/references/version-drift.md` "Changes inside v5", and the version line at the top of `SKILL.md`.
  - Bump `evals/reference-app/package.json` and re-run the reference app.
- **After editing a template:** copy it into `evals/reference-app/` and run the reference app.
- **Measuring changes:** run `evals/tasks/` with your real models before and after, using `--variant natural`, 3+ runs each.
