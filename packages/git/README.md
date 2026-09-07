# @glizzus/git

Drives the `git` command line for one repository: fetch, checkout, rev-parse,
and worktrees. This is the one package that knows how to spawn git and read
its output; everything above it calls methods on a `Git` and never sees an
argument list.

## Guidelines

Git, not GitHub. Nothing in here knows about pull requests, `pull/N/head`
refs, or any hosting service; those conventions belong in
`@glizzus/github`, which hands this package plain refspecs. Mirror git's
own vocabulary rather than inventing friendlier names.

Every `Git` takes a runner, defaulting to one that spawns the real binary.
Tests inject a fake runner and assert on the argument lists, so they never
touch a repository.
