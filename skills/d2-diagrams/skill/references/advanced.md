# Advanced D2: reuse, bulk edits, and multi-board diagrams

Reach for these when a diagram is large, repetitive, or needs several views.
For a one-off diagram of fewer than ~20 shapes, plain declarations are usually
clearer than any of this.

Contents: Classes · Variables · Globs & filters · Overrides & `null` · Model
views (`suspend`) · Imports · Composition (`layers`, `scenarios`, `steps`) ·
Links between boards · Legends

---

## Classes

Named bundles of attributes: styles, `shape`, `width`, even a `label`.

```d2
classes: {
  svc: {
    shape: hexagon
    style.fill: "#e8f0fe"
  }
  critical: {
    style.stroke: "#d93025"
    style.stroke-width: 3
  }
  async: {style.stroke-dash: 3}
}

api: API {class: svc}
billing: Billing {class: [svc; critical]}
api -> billing: event {class: async}
```

- Apply several classes with an array. They apply left to right; later ones
  win.
- Attributes set directly on the shape beat the class.
- Classes work on connections too.
- Use them to give styling meaning ("critical", "external", "async"), then
  explain that meaning in a legend.

## Variables

```d2
vars: {
  region: us-east-1
  colors: {primary: "#1f6feb"}
  base-node: {
    shape: hexagon
    style.fill: "#f1f3f4"
  }
}
lb: ${region} load balancer
api: {
  ...${base-node}
  style.stroke: ${colors.primary}
}
price: 'Costs ${not-a-var} and $5'
```

- Substitute with `${name}`; nested values use dots (`${colors.primary}`).
- Spread a map or array with `...${x}`.
- Variables are scoped like code: an inner `vars` shadows an outer one.
- Single quotes disable substitution. That is also how to write a literal `$`.
- An unknown variable is a compile error (`could not resolve variable`).
- Special variables: `vars.d2-config` (settings, see `syntax.md`) and
  `vars.d2-legend` (see Legends).

## Globs & filters

Globs apply a rule to many shapes or edges at once. They apply to matches
declared both before **and after** the glob, and they only reach into the
scope where they are written.

```d2
*.style.border-radius: 8
**.style.font-size: 16
*-db.shape: cylinder
(* -> *)[*].style.stroke: "#5f6368"
```

What each pattern matches:

| Pattern | Matches |
|---|---|
| `*` | every shape in the current scope |
| `**` | recursively, every shape at every depth |
| `*-db` | names ending in `-db` (case-insensitive) |
| `(* -> *)[*]` | every edge in scope |
| `(a -> *)[*]` | every edge out of `a` |

Filters narrow a glob with `&key: value`; use `!&` to negate.

```d2
web
pg.shape: cylinder
redis.shape: cylinder
web -> pg
*: {
  &shape: cylinder
  style.multiple: true
}
*: {
  !&shape: cylinder
  style.fill: "#fff8e1"
}
```

Filter keys:

- Any reserved keyword: `&shape`, `&label`, `&class`, `&link: *` (has a link).
- `&connected: true|false`.
- `&leaf: true|false`.
- `&level: N`.
- For edges, `&src` and `&dst`, which can test an endpoint's attributes:
  `&src.style.fill: blue`.

Behavior to know:

- `* -> *` skips self-loops.
- `**` in edges only connects leaf shapes.
- Glob edges can explode quickly. On a few dozen shapes, check the PNG for
  spaghetti.

## Overrides & `null`

Redeclaring a shape merges into it, and the last label wins. `null` deletes:

```d2
a -> b -> c
b.style.fill: red
b.style.fill: null
(b -> c)[0]: null
c: null
```

Deleting a shape deletes its connections and children. This is mostly useful
after imports and inside scenarios and steps.

## Model views (`suspend`/`unsuspend`)

Define the full model once, hide everything, then reveal one view. This is
useful for showing several perspectives of one system without copy-paste,
especially combined with imports.

```d2
backend: {
  api -> db
  api -> cache
}
frontend: {web}
frontend.web -> backend.api

**: suspend
(** -> **)[*]: suspend

frontend: unsuspend
frontend.web: unsuspend
backend: unsuspend
backend.api: unsuspend
(frontend.web -> backend.api)[0]: unsuspend
```

`unsuspend` also takes filters, for example
`(** -> **)[*]: unsuspend {&dst: backend.api}`.

## Imports

```text
# team.d2
people: {
  joe: {shape: person}
  jan: {shape: person}
}
```

```text
# main.d2
team: @team             # whole file as the value of `team`
svc: {...@team}         # spread the file's contents into a map
...@team.people         # partial import: only `people`'s children, at root
joe -> api              # (only valid after the partial import above)
```

- Paths are relative to the importing file. Omit `.d2`; `d2 fmt` removes it
  anyway.
- Quote a filename that contains dots: `@"schema-v0.1.2"`.
- Spread imports only work inside a map: `a: ...@x` is invalid.
- Typical uses:
  - a shared `styles.d2` holding `classes` and `vars`, spread at the top of
    each diagram;
  - one model file with several view files.

## Composition: `layers`, `scenarios`, `steps`

One file can hold several **boards**.

| Keyword | Each board starts from | Use for |
|---|---|---|
| `layers` | nothing (blank board) | zoom levels: context → containers → components |
| `scenarios` | the base board | alternate states of the same system (outage, migration) |
| `steps` | the previous step | a build-up or walkthrough, frame by frame |

```d2
a: Client
b: API
a -> b

layers: {
  internals: API internals {
    router -> handlers -> store
  }
}

scenarios: {
  outage: API down {
    b.style.opacity: 0.3
    a -> cache: serve stale
  }
}

steps: {
  1: {
    c: Worker
  }
  2: {
    b -> c: enqueue
  }
}
```

- Board labels come after the colon (`internals: API internals {…}`).
- Board names containing dots need quotes: `layers: {"2024.06": {…}}`.
- Export behavior:
  - A multi-board file renders to a **folder**: `out/index.png`,
    `out/layers/internals.png`, `out/scenarios/outage.png`,
    `out/steps/1.png`…
  - `--target=''` renders only the root board. `--target='layers.internals'`
    renders one board, and a trailing `.*` includes that board's children.
  - `--animate-interval=1200` packs the boards into one animated SVG or GIF,
    which is good for `steps`.
  - PDF and PPTX put one board per page or slide, with links between them.
- Boards inherit `vars` and `classes` the same way they inherit shapes. Define
  shared styling at the root.

## Links between boards

```d2
api: API {link: layers.internals}

layers: {
  internals: {
    router
    up: Back to overview {link: _}
  }
}
```

In a `link` value, `_` means the **parent board**, not the parent container.
Links are clickable in SVG, PDF and PPTX. In PNG they are listed in an
appendix.

## Legends

```d2
vars: {
  d2-legend: {
    svc: Service {shape: hexagon}
    db: Datastore {shape: cylinder}
    svc -> db: async {style.stroke-dash: 3}
  }
}
api: {shape: hexagon}
pg: {shape: cylinder}
api -> pg: {style.stroke-dash: 3}
```

- The legend renders beside the diagram. Every shape and edge declared inside
  `d2-legend` appears in it.
- To show only an edge, hide its endpoints with `style.opacity: 0`.
- Give the legend a label to rename it: `d2-legend: Key { … }`.
- For a simple key, a `near: bottom-right` container of `shape: text` items
  also works.
