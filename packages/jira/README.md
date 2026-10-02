# @glizzus/jira

Talks to the [Jira Server / Data Center REST API
v2](https://docs.atlassian.com/software/jira/docs/api/REST/latest/),
authenticated with a personal access token sent as `Authorization: Bearer`.
It searches for issues and reads them; nothing here writes back to Jira. This
is the one package that knows about Jira's HTTP, tokens, and wire format, and
it also renders an issue as the Markdown an agent reads.

## Guidelines

Stay a thin client, and stay small: an endpoint is added when something in
this repo calls it, not before. Today that is search and read issues, so
every request is a GET. Mirror Jira's resources and field names so each can
be looked up in Atlassian's docs. Surface API errors as thrown errors
carrying the status and Jira's error body -- both `errorMessages` and the
per-field `errors` -- and do not swallow them.

The token is passed in by the caller. Where it comes from -- an environment
variable, a secret store, a personal access token minted in Jira's profile
settings -- is the caller's decision, not this package's.

Server / Data Center, v2 only. Jira Cloud's v3 API is a different product with
a different document format; here, descriptions and comment bodies are
wiki-markup strings, not ADF, and they are passed through as written.

`renderIssue` is the one presentation helper in the package, because every
consumer needs the same ticket text in front of an agent: metadata, the
description, the related issues, and the discussion. Keep it pure.

Tests stub `fetch` and never hit the network.
