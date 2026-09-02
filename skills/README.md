# skills/

[Claude Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills)
that expose the engine to Claude. Each subdirectory is one skill: a `SKILL.md`
with frontmatter (`name`, `description`) and instructions, plus any scripts the
instructions tell Claude to run.

A skill is also a pnpm workspace member, so its scripts can import the engine
through `"@ynab-engine/<name>": "workspace:*"` rather than re-implementing it.

Layout of a skill:

```
skills/<name>/
  skill/SKILL.md   what the skill does and when to use it; skill/ is copied
                   into dist/ verbatim by the build
  package.json     name is @ynab-engine/<name>; `bin` lists the scripts SKILL.md invokes
  src/             TypeScript sources; one file per script, plus the modules they share
  dist/            the installable skill: SKILL.md beside the bundled scripts; gitignored
```

These live here rather than in `.claude/skills/` because they are the product,
not tooling for working on this repo: they are meant to be installed into
other projects and agents.
