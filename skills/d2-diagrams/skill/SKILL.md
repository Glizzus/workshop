---
name: d2-diagrams
description: Write, render and visually verify diagrams in D2 (d2lang.com), the declarative diagram-as-code language, using the d2 CLI. Use this whenever the user mentions D2, d2lang, .d2 files or the d2 command, or asks for an architecture, system, network, flowchart, sequence, ER/database-schema, UML class, org-chart or grid diagram where D2 is the requested or available tool, including converting Mermaid, PlantUML or Graphviz into D2, fixing D2 compile errors, restyling or extending an existing .d2 file, or exporting a D2 diagram to SVG, PNG, PDF, PPTX or GIF.
compatibility: Requires Node.js 22 or newer and the d2 CLI (v0.9.0 or newer) on PATH or in D2_BIN.
---

# D2 diagrams

D2 turns a text file into a laid-out diagram. The language is small and
forgiving, which is the problem: many mistakes compile cleanly into a diagram
that says something you did not mean. This skill is mostly about not shipping
those. Written and tested against **d2 v0.9.0** (Sept 2026); check
`d2 --version` and treat anything older with suspicion (see "What changed
recently").

## The workflow

1. **Decide what the diagram must show** before writing syntax: the audience,
   the one question it answers, and the diagram type. A diagram that tries to
   show everything shows nothing; prefer two focused diagrams (or layers) over
   one crowded one.
2. **Write the `.d2` file.** Start from the matching recipe in
   `references/recipes.md` when one fits.
3. **Run the checker** on it:
   ```bash
   node <skill-dir>/scripts/d2check.js diagram.d2 [--layout elk|tala]
   ```
   It runs `d2 fmt`, compiles, renders a PNG and an ASCII view, and lints the
   compiled structure for the silent mistakes listed below. (The ASCII view is
   a rough structural read; it truncates and omits detail. The PNG is the
   truth.) Exit 0 = clean,
   2 = rendered with warnings to read, 1 = compile error.
4. **Look at the PNG** (open it with your image-viewing tool). This step is not
   optional. Validation, compilation and the linter all pass on diagrams with
   wrong labels, wrong nesting and missing pieces. Check that:
   - every label reads as intended;
   - nothing is nested that should not be;
   - every expected connection is there exactly once;
   - the layout reads in the intended direction;
   - the overall shape suits where the diagram is going. A 5:1 strip
     shrinks to unreadable text in a doc or wiki; the checker warns above 3:1.
5. **Iterate** until the picture is right, then export what the user needs
   (see "Exporting").

Do not use `d2 validate` as your check. It only parses; unknown shapes, bad
`direction` values and invalid style keys all pass it and fail at render.

If `d2` is not installed: `brew install d2` (macOS),
`curl -fsSL https://d2lang.com/install.sh | sh -s --`, or download
`d2-<version>-<os>-<arch>.tar.gz` from github.com/d2lang/d2/releases and put
`bin/d2` on PATH.

## The mental model

Almost every D2 bug comes from misreading one of these rules.

**A D2 file is nested key–value maps.**
- `key` declares a shape. The key is its ID; by default the ID is also the label.
- `key: text` sets the label. *Everything* after the first colon up to end of
  line (or `{`, `;`, `#`) is the label.
- `key: label { ... }` opens a map for that shape: children, `shape`, `style`…
- `a.b.c` is a **path**: shape `c` inside container `b` inside `a`. Every
  unquoted dot creates nesting.
- `;` separates declarations on one line. `#` starts a comment.

**Connections reference IDs, and are additive.**
- `a -> b`, `a <- b`, `a <-> b`, `a -- b`. Chains work: `a -> b -> c`.
- They name shapes by **ID, not label**. If `be: Backend` exists,
  `Backend -> db` creates a *new* shape called Backend.
- Writing `a -> b` twice draws **two** edges. To change an existing edge, refer
  to it by index: `(a -> b)[0].style.stroke: red`.
- Referencing an undeclared shape creates it. That is convenient for drafts and
  dangerous for typos.

**Names are scoped to the container they are written in.**
- Inside `svc: { api -> db }`, `db` means `svc.db`, even if a top-level `db`
  exists. Use `_.db` to reach the parent scope, or write the connection at
  the outer level: `svc.api -> db`.
- Redeclaring a shape merges into it (later label wins). `x: null` deletes.

**Keywords are reserved, in any casing**: `label shape icon style class
classes near width height top left direction tooltip link constraint vars
layers scenarios steps` and the `style.*` keys. Two consequences:
- Write them lowercase. `x.Shape: circle` is silently ignored. `d2 fmt`
  lowercases keywords, which is one reason the checker runs it.
- Don't use one as a shape ID, even capitalized. `Link`, `Label`, `Width` or a
  UML class called `Shape` errors (`reserved field ... must have a value` /
  `does not accept composite`). Quoting compiles but lowercases the label. Use
  another ID and put the word in the label: `link_svc: Link`,
  `shape_base: Shape {shape: class}`. Inside a `sql_table` or `class`, quote
  keyword-named rows: `"label": string`.

**Quote anything that is not a plain word**:
`"api.example.com"`, `"v1.2.3"`, `"config.yaml"`, `"Issue #42"`,
`"fetch; parse"`, `"[]string"`, and colors `"#1f6feb"`. Text containing `$`
needs single quotes (`'$5/month'`): double-quoted strings still attempt
`${var}` substitution. Use `\n` in a label
for a line break.

## Silent mistakes (compile fine, render wrong)

Each of these was verified against v0.9.0. The checker flags the ones marked ✓.

| You write | What D2 does | Write instead |
|---|---|---|
| `api.example.com -> db` ✓ | three nested containers `api › example › com` | `"api.example.com" -> db` |
| `t: Issue #42 fixed` ✓ | label is just `Issue` | `t: "Issue #42 fixed"` |
| `s: fetch; parse` ✓ | label `fetch` plus a new shape `parse` | `s: "fetch; parse"` |
| `svc: { api -> db }` with a top-level `db` ✓ | a second `db` inside `svc` | `svc: { api -> _.db }` |
| `a -> b` written twice ✓ | two parallel arrows | write once; restyle via `(a -> b)[0]` |
| `x.Shape: circle` ✓ (fmt) | ignored, stays a rectangle | `x.shape: circle` |
| `base: Shape`, `a -> b: Label` then `d2 fmt` ✓ | fmt lowercases the label to `shape`/`label` | quote labels that spell a keyword: `base: "Shape"` |
| `Backend -> db` when `be: Backend` exists | new shape "Backend" | `be -> db` |
| `api: API.class: svc` | label is literally `API.class: svc` | `api: API {class: svc}` |
| `id: int PRIMARY KEY` in a `sql_table` | the row is dropped | `id: int {constraint: primary_key}` |
| `a -> b: {source-arrowhead.shape: cf-many}` | source arrowhead not drawn | `a <-> b` when both ends need a marker |
| sequence group before its actors are declared | the group becomes an actor | declare actors first (see recipes) |
| `direction: right` inside a container (dagre/elk) | ignored | per-container direction needs `--layout=tala` |
| remote `icon:` with no network | grey placeholder in PNG | fine when rendered online; not a code bug |

## Loud errors and what they really mean

| Error | Usual cause |
|---|---|
| `missing value after colon` | unquoted `#color` (the `#` began a comment): quote it |
| `unexpected text after map key` | Mermaid habits like `a[Label]` or `a(("x"))`: D2 is `a: Label` |
| `unexpected text after unquoted string` | brackets in a label (`list[int]`): quote it |
| `substitutions must begin on {` | a `$` in a label: use **single** quotes (`'costs $5'`); double quotes still substitute |
| `... has "near" set to another object, but layout engine ... only supports constant values` | `near: <shape>` needs `--layout=tala` |
| `unknown shape "database"` | not a D2 shape name: see `references/syntax.md` (database → `cylinder`) |
| `invalid style keyword: "color"` | not a style key (text color is `font-color`) |
| `direction must be one of up, down, right, left` | `horizontal`/`LR`/`TB` are not D2 |
| `near keys cannot be set to an ancestor` | `near: top` etc.; constants are `top-center`, `bottom-left`… |
| `reserved keywords are prohibited in edges`, `reserved field "X" must have a value`, `reserved field X does not accept composite` | a shape ID is a keyword in some casing (`Link`, `Label`, `Shape`…): rename the ID, keep the word as the label |
| `... goes from a container to a descendant, but layout engine "dagre" does not support this` | use `--layout=elk` or `tala`, or connect to a sibling |
| `could not resolve variable "x"` | `${x}` with no matching `vars` entry in scope |

## Making diagrams that read well

- **Short IDs, readable labels.** `pg: PostgreSQL 16 {shape: cylinder}` keeps
  connection lines short and avoids quoting trouble.
- **Containers mean something.** Use them for real boundaries (VPC, service,
  team, trust zone), not decoration. Deep nesting hurts layout; 2–3 levels is
  plenty.
- **Choose `direction` on purpose, and mind the output's shape.** `right`
  suits short pipelines; `down` (the default) suits hierarchies and most
  architecture diagrams. A `direction: right` architecture with many
  components tends to come out as a very wide strip; in testing, the same
  diagram as `direction: down` with `--layout=tala` came out roughly square
  with much larger text. When a render is lopsided, try the other direction
  and the other engines, and compare the PNGs.
- **Label edges with the verb or protocol** (`HTTPS`, `publishes`, `SQL`), short.
  Long text belongs in a `|md` block or a `tooltip`.
- **Style through `classes`**, not repeated inline styles; it keeps meaning
  consistent (all queues look like queues) and edits cheap. Prefer the theme's
  colors; when you do set colors, use a small palette and make it mean
  something, and add a legend (`vars.d2-legend`) when color or line style
  carries meaning.
- **Use the right special shape**: `cylinder` for databases, `queue`,
  `person`, `cloud`, `sql_table` for schemas, `class` for UML,
  `sequence_diagram` for message order. They carry meaning at a glance.
- **Split instead of cramming.** More than ~25 shapes or heavy edge crossing
  usually means two diagrams, or `layers` for zoom levels.
- **Order is not meaningful outside sequence diagrams.** Declaration order
  does not control placement; layout engines decide. Use `direction`, grids,
  containers, or TALA's `near`/`top`/`left` for control.

## Layout engines

All three ship inside the d2 binary (as of 0.9.0; TALA used to be a paid
plugin). Select with `--layout=NAME` or in the file:
`vars: { d2-config: { layout-engine: elk } }`.

- **dagre** (default): fast, hierarchical. Cannot connect a container to its
  own child; one global direction.
- **elk**: cleaner orthogonal routing; better with many edges and with
  `sql_table` rows (edges hit the exact row); supports container `width`/`height`.
- **tala**: built for software architecture. Only engine with per-container
  `direction`, `near: <shape>`, and `top`/`left` pinning.

If the dagre result is tangled, try `elk` before rearranging the source.
No engine wins everywhere. In testing:
- ELK gave the cleanest left-to-right architecture and row-accurate ER edges.
- TALA gave the most compact top-down architecture.

Rendering a candidate with each engine is cheap, so compare them.

## Exporting

`d2 in.d2 out.svg` (default), or `.png`, `.pdf`, `.pptx`, `.gif`, `.txt`
(ASCII). PNG, PDF and PPTX use the built-in renderer: no browser download.
Useful flags: `--theme=ID` (list with `d2 themes`; `--dark-theme=200` for
dark-mode SVG), `--sketch` (hand-drawn look), `--pad=N`, `--scale=N`,
`--center`, `--layout=…`. The same settings can live in the file under
`vars.d2-config` (`theme-id`, `dark-theme-id`, `sketch`, `pad`, `center`,
`layout-engine`). Command-line flags win over the file.

- A file with `layers`/`scenarios`/`steps` writes a **folder** of outputs
  (`out/index.png`, `out/layers/x.png`…). `--target=''` renders only the root
  board. `--animate-interval=1200` packs boards into one animated SVG or GIF.
- Default SVG output bundles remote icons and fails when they can't be
  fetched; `--bundle=false` keeps them as URLs.
- For embedding in HTML: `--no-xml-tag`; for several diagrams on one page,
  `--salt=NAME` to avoid ID collisions.
- `d2 --watch in.d2` serves a live-reloading preview for a human. Don't use it
  as an agent check.

## Reference files

Read these when the task needs them; they are not needed for a simple diagram.

- `references/syntax.md`: the complete closed vocabularies (every shape,
  style key with its valid range, arrowhead, `near`/label position, theme ID,
  `d2-config` key) plus text blocks (Markdown, code, LaTeX), icons, links and
  tooltips. Check here instead of guessing a value.
- `references/recipes.md`: tested starting points for architecture,
  flowchart, sequence, ER/SQL, UML class, grid and C4-style diagrams, with the
  quirks specific to each type.
- `references/advanced.md`: `classes`, `vars`, globs and filters,
  `suspend`/`unsuspend` model views, imports, `null` overrides, and
  multi-board composition (`layers`, `scenarios`, `steps`, internal links).

## What changed recently (if your memory says otherwise, trust this)

- **0.9.0**: TALA is open source and bundled (`--layout=tala`, no license).
  PNG/GIF/PDF/PPTX exports use a built-in renderer (no Chromium).
  Markdown labels render as native SVG.
- **0.8.x**: dagre and ELK reimplemented natively, so layouts may differ from
  older renders of the same file.
- **0.7.x**: ASCII output (`.txt`), `cross` arrowhead, Markdown/LaTeX/code as
  edge labels, `border-*` label positions, `d2 validate`, legends
  (`vars.d2-legend`), `shape: c4-person`, `suspend`/`unsuspend`,
  edge-endpoint glob filters (`&src`, `&dst`), icons on connections.
- **0.6.9**: LaTeX blocks no longer need doubled backslashes; reserved
  keywords must be unquoted to act as keywords.
