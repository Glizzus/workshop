# @glizzus/pr-preview

Polls a GitHub repository every minute and keeps one git worktree per open
pull request, each with a port of its own. Two scripts of yours decide what
a preview is; the daemon only manages a clone, worktrees, and ports. The
repository itself needs nothing added to it.

```
pr-preview <owner/name> [dir] [--allow-forks]
```

Everything lives under `dir`, which defaults to `./<name>` and is created on
first run:

- `repo.git`: a bare clone of the repository, made on first run and fetched from after that.
- `pr-<number>`: a detached worktree per open pull request.
- `state.json`: the sha and port each preview was given.
- `hooks/`: your `up` and `down` scripts, described below.

`--allow-forks` also previews pull requests whose branch lives in a fork. Off
by default, because `up` runs whatever the PR contains.

`GH_TOKEN` must hold a token that can read the repository's pull requests and
contents; it authenticates both the API and git, so no other git credentials
are needed. A fine-grained personal access token with contents read, pull
requests read, and metadata read is enough; `gh auth token` prints the one gh
is logged in with. `GITHUB_API_URL` points at a GitHub Enterprise Server
instance (`https://<host>/api/v3`); the clone URL is derived from it.

## Hooks

Executable files under `dir/hooks`, run with the worktree as the working
directory, like git hooks. They belong to you, not the repository, so a pull
request cannot change what runs for it, and nothing about previews has to
live in the repository.

- `hooks/up` runs after the worktree is created and again after each push. Install, migrate, and start the app on `$PORT`. It runs on every push, so it must cope with an instance from the previous commit already running; Docker Compose with a project name per PR does this for free, a bare dev server needs a pid file.
- `hooks/down` runs before the worktree is removed, when the PR closes or merges. Stop whatever `up` started.

Both receive `PR_NUMBER`, `PR_SHA`, and `PORT`; `up` also receives `PR_TITLE`
and `PR_URL`. Ports come from 4000 to 4999, lowest free first, and a PR keeps
its port until it closes. A missing hook is skipped; a non-zero exit is logged
and does not stop the daemon.

`up` always gets a pristine checkout of the PR's head. Before it runs on a
push, edits to tracked files are thrown away and every untracked or ignored
file is removed (`git checkout --force` then `git clean -fdx`). So the hook
may sed config, drop in an `.env` or a compose override, and install into
the tree, and none of it carries over to the next push. Anything worth
keeping between pushes, such as a warm package cache, should live outside
the worktree and be linked in.

Each poll lists open pull requests, compares them with the worktrees git
reports under `dir`, and creates, updates, or removes to match. Worktrees are
detached at the sha the API reported, so no branches are created.
