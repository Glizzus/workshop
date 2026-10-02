# jira-ai-implementer

A daemon that implements one Jira ticket a night. It finds tickets with a label
you choose, hands the first one to OpenCode in a fresh git worktree, and opens a
draft pull request with the result. You review the pull request in the morning.

It never writes to Jira. The pull requests are the record of what it has done.

## Quickstart

You need Node 24, `git`, and `opencode` on the machine that will run it, with a
model already configured in `~/.config/opencode/opencode.json`.

**1. Build it.** From the workshop root:

```sh
pnpm install
pnpm -r build
```

**2. Make a working directory.** The daemon keeps its clone, worktrees, logs
and state here. Anywhere is fine:

```sh
mkdir -p ~/jira-ai/hooks
```

**3. Write the config** at `~/jira-ai/config.json`:

```json
{
  "jira": { "baseUrl": "https://jira.example.com", "project": "PROJ" },
  "repo": { "github": "owner/name" },
  "window": { "timezone": "America/Chicago" },
  "opencode": { "model": "ollama/qwen3-coder" }
}
```

That is the minimum. Defaults fill in the label (`auto-ai-implement`), the base
branch (`main`), the window (02:00 to 04:00) and the timeout (90 minutes). The
full list is under [Configuration](#configuration).

**4. Decide where branches come from.** The daemon never creates a branch. For
each ticket it looks on origin for a branch whose name contains the issue key
and works on that. If you have tooling that creates branches, put a script at
`~/jira-ai/hooks/create-branch` that asks it to; the daemon runs the script
when no branch exists yet and then waits up to two minutes for one to appear.
Its output is ignored, only its exit code matters:

```sh
#!/bin/sh
exec curl -fsSL -o /dev/null -H "Authorization: Bearer $JIRA_TOKEN" \
  "https://jira.example.com/rest/scriptrunner/latest/custom/createBranch?issue=$ISSUE_KEY&repo=$REPO"
```

```sh
chmod +x ~/jira-ai/hooks/create-branch
```

The script gets `ISSUE_KEY`, `REPO` and `BASE_BRANCH` in its environment, plus
the daemon's own. Without a script, push a branch containing the key by hand
before running the daemon.

**5. Set the tokens:**

```sh
export JIRA_TOKEN=...   # Jira personal access token; only needs to browse the project
export GH_TOKEN=...     # GitHub token; see Environment below for scopes
```

**6. Do one ticket right now** to see it work end to end. Put the label on a
ticket, or name one directly:

```sh
node apps/jira-ai-implementer/dist/main.js ~/jira-ai/config.json ~/jira-ai --once --now --issue PROJ-123
```

It clones the repository, finds the branch, runs OpenCode, and either opens a draft
pull request (exit 0) or tells you why not (exit 1). Everything it did is under
`~/jira-ai/runs/<date>/PROJ-123/`.

**7. Run it for real.** Drop the flags and leave it running:

```sh
node apps/jira-ai-implementer/dist/main.js ~/jira-ai/config.json ~/jira-ai
```

It sleeps until the window opens, works, and sleeps again. Logs go to stderr
with a timestamp on every line. Run it under whatever keeps processes alive on
your machine.

## Usage

```
jira-ai-implementer <config.json> [dir] [--once] [--now] [--issue KEY]
```

- `config.json`: the file from step 3.
- `dir`: the working directory. Defaults to `./<repo name>`.
- `--once`: do a single attempt and exit. Exit code 0 means a pull request was opened, 1 means anything else, including nothing to do.
- `--now`: ignore the window and start immediately. Only valid with `--once`.
- `--issue KEY`: work on this ticket instead of searching. It does not need the label, and it is tried even if it already has a pull request or failed before.

The usual pairs are `--once --now --issue KEY` to try one ticket by hand, and
`--once --now` to see which ticket it would pick and do that one.

## What it does each night

Outside the window it sleeps. Inside the window, every five minutes:

1. Search Jira for open issues in the project with the label, highest priority first, oldest first within a priority.
2. Drop any issue whose key appears in the head branch of an existing pull request, open or closed. Drop any issue listed under `failed` in `state.json`.
3. Take the first one left. If there is none, sleep five minutes and look again.
4. Find the branch on origin whose name contains the key. If there is none, run `hooks/create-branch` and wait up to two minutes for one to appear. Fetch it and create a worktree on it.
5. Write the ticket, with its comments, to `ticket.md` and run OpenCode in the worktree with the `implement-jira-issue` skill loaded.
6. If OpenCode changed something, commit what is uncommitted, push, and open a draft pull request using the `pr.md` OpenCode wrote.
7. Remove the worktree. On success, the night is over. On failure, note the reason in `state.json` and go back to step 1.

One pull request per night, no matter how many tickets are labelled. A ticket
that fails is skipped on later nights until you delete its entry from
`state.json` or run it with `--issue`.

The window only decides when work may *start*. A run that is still going at
the end of the window is allowed to finish, up to `opencode.timeoutMinutes`.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `jira.baseUrl` | required | Your Jira Server or Data Center URL. |
| `jira.project` | required | The project key to search. |
| `jira.label` | `auto-ai-implement` | Tickets with this label are eligible. |
| `repo.github` | required | `owner/name` of the GitHub repository. |
| `repo.baseBranch` | `main` | What the pull request targets. |
| `window.timezone` | required | An IANA zone such as `America/Chicago`. Daylight saving is handled. |
| `window.start`, `window.end` | `02:00`, `04:00` | Local times. An end before the start means the window crosses midnight. |
| `opencode.model` | OpenCode's default | `provider/model`, passed to OpenCode as `--model`. |
| `opencode.timeoutMinutes` | `90` | How long one OpenCode run may take before it is killed. |

Not configurable, on purpose: a ticket's branch is the one on origin with its
key in the name, polling is every five minutes, pull requests are always
drafts, and commits are authored by
`jira-ai-implementer <jira-ai-implementer@users.noreply.github.com>`.

## Environment

- `JIRA_TOKEN`: a Jira personal access token. Browse access to the project is all it needs.
- `GH_TOKEN`: a GitHub token. A fine-grained token needs Contents (read and write), Pull requests (read and write) and Metadata (read). It is used for the API and for git, so no other git credentials are needed.
- `GITHUB_API_URL`: only for GitHub Enterprise Server, for example `https://github.example.com/api/v3`.

The tokens are removed from OpenCode's environment, so the model cannot push or
touch Jira no matter what it decides to do. The create-branch hook does get them.

## The working directory

- `repo.git`: a bare clone, fetched before each attempt.
- `wt-<KEY>`: the worktree for the ticket being worked on. Removed afterwards.
- `runs/<date>/<KEY>/`: `ticket.md` as the model read it, `pr.md` as it wrote it, `opencode.jsonl` with the full transcript, and `opencode.stderr.log`. Never deleted.
- `state.json`: the date of the last pull request and the failed tickets with reasons.
- `hooks/create-branch`: your optional script from the quickstart.

## When something goes wrong

- **It will not start.** The message says what is missing: a token or a bad config value. Config errors name the key.
- **"No branch for PROJ-123 on origin".** Nothing on origin has that key in its name, and either there is no `hooks/create-branch` or the branch it asked for did not appear within two minutes. Check the hook by running it by hand with `ISSUE_KEY=PROJ-123 REPO=owner/name BASE_BRANCH=main`.
- **A ticket failed.** The reason is in the log and in `state.json`. For OpenCode problems read `runs/<date>/<KEY>/opencode.stderr.log`. "No changes produced" means the model read the ticket and wrote nothing. Fix the ticket or the setup, delete the key from `state.json`, and it will be tried again.
- **It keeps skipping a ticket.** Either it already has a pull request whose branch name contains the key, or it is under `failed`.
- **OpenCode flags.** The daemon passes `--auto`, `--dir`, `--format json` and `--model` to `opencode run`, and hands over its own instructions and permissions through `OPENCODE_CONFIG_CONTENT`. If your OpenCode version names these differently, `opencodeArgs` and `opencodeConfig` in `src/opencode.ts` are the only places to change, and both have tests.
