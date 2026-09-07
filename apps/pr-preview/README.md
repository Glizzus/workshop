# @glizzus/pr-preview

Polls a GitHub repository every five minutes and keeps one git worktree per
open pull request, each with a port of its own. The repository decides what
a preview is by shipping two scripts; the daemon only manages worktrees and
ports.

```
pr-preview <owner/name> [--checkout <dir>] [--root <dir>] [--allow-forks]
```

- `--checkout`: a local clone whose `origin` is the repository. Defaults to the current directory.
- `--root`: where previews live, one worktree per PR at `<root>/pr-<number>`, plus `state.json`. Defaults to `.pr-preview`. Ignore it in git.
- `--allow-forks`: also preview pull requests whose branch lives in a fork. Off by default, because the hooks run whatever the PR contains.

`GH_TOKEN` must hold a token that can read the repository's pull requests. A fine-grained personal access token with pull requests read and metadata read is enough; `gh auth token` prints the one gh is logged in with. `GITHUB_API_URL` points at a GitHub Enterprise Server instance (`https://<host>/api/v3`).

## Hooks

Executable files in the repository, run with the worktree as the working directory, like git hooks:

- `.pr-preview/up` runs after the worktree is created and again after each push. Install, migrate, and start the app on `$PORT`. It runs on every push, so it must cope with an instance from the previous commit already running; Docker Compose with a project name per PR does this for free, a bare dev server needs a pid file.
- `.pr-preview/down` runs before the worktree is removed, when the PR closes or merges. Stop whatever `up` started.

Both receive `PR_NUMBER`, `PR_SHA`, and `PORT`; `up` also receives `PR_TITLE` and `PR_URL`. Ports come from 4000 to 4999, lowest free first, and a PR keeps its port until it closes. A missing hook is skipped; a non-zero exit is logged and does not stop the daemon.

Each poll lists open pull requests, compares them with the worktrees git reports under the root, and creates, updates, or removes to match. Worktrees are detached, so no branches are created.
