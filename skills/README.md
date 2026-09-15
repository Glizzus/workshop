# skills/

[Claude Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills)
that expose the engine to Claude. Each subdirectory is one skill: a `SKILL.md`
with frontmatter (`name`, `description`) and instructions, plus any scripts the
instructions tell Claude to run.

A skill is also a pnpm workspace member, so its scripts can import the engine
through `"@glizzus/<name>": "workspace:*"` rather than re-implementing it.

Layout of a skill:

```
skills/<name>/
  skill/SKILL.md   what the skill does and when to use it; skill/ is copied
                   into dist/ verbatim by the build
  package.json     name is @glizzus/<name>; `bin` lists the scripts SKILL.md invokes
  src/             TypeScript sources; one file per script, plus the modules they share
  dist/            the installable skill: SKILL.md beside the bundled scripts; gitignored
```

A skill with no scripts, only instructions and reference files, skips `src/`
and tsup: its `build` copies `skill/` to `dist/` (see
`drizzle-sql-server-migrate`).

These live here rather than in `.claude/skills/` because they are the product,
not tooling for working on this repo: they are meant to be installed into
other projects and agents.

## Distribution

Consumers install from [glizzus/skills](https://github.com/glizzus/skills),
never from this repo. `.github/workflows/publish-skills.yml` runs on every push
to `main`: it builds and tests, copies each `skills/<name>/dist` to
`skills/<name>` in a checkout of that repo along with
`.github/skills-repo/README.md`, validates the tree with
`gh skill publish --dry-run`, commits, and tags a release `v1.<run number>.0`.
Consumers pick one skill by name:

```sh
gh skill install glizzus/skills <name>        # Copilot CLI
npx skills add glizzus/skills --skill <name>  # any agent the skills CLI knows
```

Do not point either tool at this repo. `skills/<name>/skill/SKILL.md` matches
their discovery rules too, and would install a skill without its scripts.

A new skill needs nothing beyond its package: the workflow ships every
`skills/*/dist`. Its scripts run on the consumer's machine with whatever Node
is installed there, so keep `target` in `tsup.config.ts` at `node22`, Copilot
CLI's floor, and say so in the `compatibility` field of `SKILL.md`. The
workflow needs the `SKILLS_REPO_TOKEN` secret, a fine-grained personal access
token with Contents read and write on the artifact repo.
