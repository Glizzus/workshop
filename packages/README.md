# packages/

Libraries that make up the engine. Each subdirectory is one pnpm workspace
member with its own `package.json`, and is imported by other packages or by a
skill under `skills/` -- nothing in here is a runnable entry point on its own.

Layout of a package:

```
packages/<name>/
  package.json     name is @glizzus/<name>
  src/             TypeScript sources
  dist/            build output, gitignored
```

Depend on a sibling with `"@glizzus/<name>": "workspace:*"`.
