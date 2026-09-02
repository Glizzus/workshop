# @ynab-engine/ynab

Talks to the [YNAB API](https://api.ynab.com). This is the one package that
knows about HTTP, tokens, and YNAB's wire format; everything above it works
with the types this package returns and never sees a request.

## Guidelines

Stay a thin client. Mirror the API's resources and field names rather than
inventing friendlier ones -- renaming is a job for the packages that consume
this one, where the domain meaning is known. Surface API errors as thrown
errors carrying the status and YNAB's error body; do not swallow them.

Tests are table-driven and never hit the network.
