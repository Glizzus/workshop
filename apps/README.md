# apps/

Runnable programs: daemons and CLIs with a lifecycle of their own. They are
the third kind of workspace member. `packages/` are libraries that apps and
skills import; `skills/` are instructions plus scripts that get installed into
an agent; an app is neither imported nor installed, it is started.

An app may shell out to an agent (`claude -p ...`) as one step of what it does,
but it does not need one to run. The deterministic parts -- polling, process
management, file layout -- live here, so they behave the same every time and
fail in ways that can be read from a log.

Layout of an app:

```
apps/<name>/
  package.json     name is @glizzus/<name>; `bin` names the executable
  src/             TypeScript sources; main.ts is the entry point
  dist/            tsc output, gitignored; runs in place against node_modules
  README.md        how to configure and run it
```

Apps build with `tsc` rather than bundling, because they run from their own
directory where `node_modules` is available. Depend on a sibling package with
`"@glizzus/<name>": "workspace:*"`.
