# @glizzus/d2

Drives the [`d2`](https://d2lang.com) command line and lints D2 sources for
the mistakes that compile cleanly into a diagram that says something else:
capitalized keywords, an unquoted `#` or `;` inside a label, dotted names
split into nested containers, one short name at several scopes, and
connections written twice.

There are two lints, because the mistakes show up in two places:

- `sourceLint(text)` reads the `.d2` text. Run it before `d2 fmt`, which
  "fixes" these traps in a way that hides them.
- `structureLint(svg, text)` reads the compiled object tree out of an SVG that
  `D2.render` wrote with `bundle: false`; d2 stores every object and
  connection ID, base64-encoded, as the class of its `<g>`.

`protectKeywordLabels(text)` quotes labels such as `x: Shape` before
`d2 fmt` can lowercase them into `x: shape`.

## Guidelines

The lints are pure functions over strings and return messages; deciding what
to print, which files to write and what exit code to use belongs to the
caller (the `d2-diagrams` skill's `d2check` script).

`D2` takes a runner, defaulting to one that spawns `$D2_BIN` or the `d2` on
PATH. A non-zero exit resolves rather than rejects, since a compile error is
the answer a caller asked for. Tests inject a fake runner and assert on the
argument lists, so they never need d2 installed.
