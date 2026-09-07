# @glizzus/github

Talks to the [GitHub REST API](https://docs.github.com/en/rest). This is the
one package that knows about GitHub's HTTP, tokens, and wire format, and
about the conventions GitHub layers on top of git, such as the `pull/N/head`
ref that exposes a pull request's commits.

## Guidelines

Stay a thin client, and stay small: an endpoint is added when something in
this repo calls it, not before. Mirror the API's resources and field names so
each can be looked up in GitHub's docs. Surface API errors as thrown errors
carrying the status and GitHub's error body; do not swallow them.

GitHub, not git. This package never runs git; it produces refspecs that
`@glizzus/git` consumes.

The token is passed in by the caller. Where it comes from -- `GH_TOKEN`, a
fine-grained personal access token, `gh auth token` -- is the caller's
decision, not this package's.

Tests stub `fetch` and never hit the network.
