# @glizzus/pr-preview

Polls a GitHub repository every minute and keeps one git worktree per open
pull request, each with a port of its own. The repository decides what a
preview is by shipping two scripts; the daemon only manages a clone,
worktrees, and ports.

```
pr-preview <owner/name> [dir] [--allow-forks]
```

Everything lives under `dir`, which defaults to `./<name>` and is created on
first run:

- `repo.git`: a bare clone of the repository, made on first run and fetched from after that.
- `pr-<number>`: a detached worktree per open pull request.
- `state.json`: the sha and port each preview was given.

`--allow-forks` also previews pull requests whose branch lives in a fork. Off
by default, because the hooks run whatever the PR contains.

`GH_TOKEN` must hold a token that can read the repository's pull requests and
contents; it authenticates both the API and git, so no other git credentials
are needed. A fine-grained personal access token with contents read, pull
requests read, and metadata read is enough; `gh auth token` prints the one gh
is logged in with. `GITHUB_API_URL` points at a GitHub Enterprise Server
instance (`https://<host>/api/v3`); the clone URL is derived from it.

## Hooks

Executable files in the repository, run with the worktree as the working
directory, like git hooks:

- `.pr-preview/up` runs after the worktree is created and again after each push. Install, migrate, and start the app on `$PORT`. It runs on every push, so it must cope with an instance from the previous commit already running; Docker Compose with a project name per PR does this for free, a bare dev server needs a pid file.
- `.pr-preview/down` runs before the worktree is removed, when the PR closes or merges. Stop whatever `up` started.

Both receive `PR_NUMBER`, `PR_SHA`, and `PORT`; `up` also receives `PR_TITLE`
and `PR_URL`. Ports come from 4000 to 4999, lowest free first, and a PR keeps
its port until it closes. A missing hook is skipped; a non-zero exit is logged
and does not stop the daemon.

Each poll lists open pull requests, compares them with the worktrees git
reports under `dir`, and creates, updates, or removes to match. Worktrees are
detached at the sha the API reported, so no branches are created.
