---
name: implement-jira-issue
description: Implement one Jira issue in the current repository from a ticket.md file, then write the pull request title and body to pr.md. Use when a prompt names a ticket.md to implement.
compatibility: Runs inside OpenCode or any agent with file edit and shell access, in a git checkout that is already on the right branch.
---

# implement-jira-issue

You are implementing one Jira ticket. The repository is checked out on the right branch. Nobody will answer questions, so decide for yourself and write the decision down in pr.md. When you stop, the daemon commits your changes, pushes, and opens a draft pull request from pr.md. If you change nothing, the attempt fails.

## Rules

- Change only what the ticket asks for.
- Do not push. Do not open a pull request. Do not switch or create branches.
- Do not run `git reset --hard`, `git clean`, `git checkout -- .`, or anything with `--force`.
- Do not write files outside the repository, except pr.md.
- Do not add dependencies unless the ticket requires them.
- Do not delete, skip, or weaken a failing test to make it pass.
- Write code the way the existing code is written.

## Steps

1. Read ticket.md to the end, including the comments. A later comment overrides the description.
2. Find the files the ticket is about. Read a file before you change it.
3. Make the change. Keep it small.
4. Run the project's tests and build. The commands are in package.json, a Makefile, or the README. Fix what you broke.
5. Run `git status` and `git diff`. Remove anything not related to the ticket.
6. Write pr.md in the format below, then stop.

If the ticket is unclear, take the simplest reasonable reading and note it under Open questions. If the ticket cannot be done at all, change no files and write pr.md saying why.

## pr.md format

Line 1 is the title: the issue key, a colon, and a short summary. Then a blank line, then the body.

```markdown
PROJ-123: reject expired invite tokens

## Summary

Redeeming an invite past its expiry date returned 200. It now returns 410.

## Changes

- `src/routes/invites.ts`: check `expiresAt` before looking up the invite.
- `src/routes/invites.test.ts`: a test for an expired token.

## Testing

- `pnpm test`: passed.

## Open questions

- None.
```

When the prompt names no pr.md path, put the same title and body in your reply instead.
