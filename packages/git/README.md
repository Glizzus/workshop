# @glizzus/git

Drives the `git` command line for one repository: fetch, checkout, commit,
and worktrees. This is the one package that knows how to spawn git and read
its output; everything above it calls methods on a `Git` and never sees an
argument list.

A clone made with `--bare` has no `remote.origin.fetch` refspec, so a plain
`fetch("origin")` updates nothing a later command can name. A caller that wants
an up-to-date remote-tracking ref fetches with an explicit destination and then
branches from it:

```ts
await git.fetch("origin", "+refs/heads/main:refs/remotes/origin/main");
const wt = await git.worktreeAdd(dir, "refs/remotes/origin/main", { branch: "feature" });
```

## Guidelines

Git, not GitHub. Nothing in here knows about pull requests, `pull/N/head`
refs, or any hosting service; those conventions belong in
`@glizzus/github`, which hands this package plain refspecs. Mirror git's
own vocabulary rather than inventing friendlier names.

Every `Git` takes a runner, defaulting to one that spawns the real binary.
Tests inject a fake runner and assert on the argument lists, so they never
touch a repository.
