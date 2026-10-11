# D2 syntax reference (v0.9.0)

Closed vocabularies, taken from the d2 source. If a value is not listed here,
it is not valid; don't guess.

Contents: Shapes · Dimensions · Style keys · Colors · Connections & arrowheads ·
Positions (`near`) · Direction · Text blocks · Icons & images · Links &
tooltips · Comments · Themes · `d2-config` · Root styles

## Shapes

Set with `shape: <name>`; the default is `rectangle`.

| Shape | Use for |
|---|---|
| `rectangle` (default), `square` | generic components; `square` keeps a 1:1 ratio |
| `oval`, `circle` | states, start/end, events; `circle` keeps a 1:1 ratio |
| `diamond` | decisions in flowcharts |
| `parallelogram` | input/output in flowcharts |
| `hexagon` | services, processes |
| `cylinder` | databases (there is no `database` shape) |
| `queue` | message queues, streams |
| `stored_data` | caches, storage |
| `document`, `page` | files, reports, documents |
| `package` | modules, libraries, bundles |
| `step` | pipeline stages (chevron) |
| `callout` | annotations |
| `cloud` | internet, external cloud |
| `person`, `c4-person` | users and actors |
| `text` | free text with no box |
| `code` | a code block (usually written via a `\|lang` block string) |
| `image` | a bare icon; requires `icon:` |
| `class` | UML class (see recipes) |
| `sql_table` | database table (see recipes) |
| `sequence_diagram` | turns a container into a sequence diagram |

Write shape names lowercase; `Shape: Circle` is silently ignored until
`d2 fmt` lowercases it.

## Dimensions

`width: 200`, `height: 80` (pixels). They work on all shapes in every engine;
on *containers* they work with ELK and TALA only. Shapes may be set smaller
than their label. Giving busy hub shapes extra width spreads their connections
out.

## Style keys

Write style keys under `style`: either `x.style.fill: red` or
`x: { style: { fill: red; stroke: blue } }`. Any key not in this table is an
error (`invalid style keyword`).

| Key | Values | Applies to |
|---|---|---|
| `fill` | color, gradient, `transparent` | shapes; for `sql_table`/`class`, the header |
| `stroke` | color or gradient | shapes, connections |
| `stroke-width` | 0–15 | shapes, connections |
| `stroke-dash` | 0–10 (0 = solid) | shapes, connections |
| `opacity` | 0–1 | shapes, connections |
| `border-radius` | ≥ 0 | shapes |
| `fill-pattern` | `none` `dots` `lines` `grain` `paper` | shapes |
| `shadow` | `true`/`false` | shapes |
| `multiple` | `true`/`false` (stacked look) | shapes |
| `3d` | `true`/`false` | `rectangle`, `square`, `hexagon` only (error otherwise) |
| `double-border` | `true`/`false` | `rectangle`, `square`, `circle`, `oval` only (error otherwise) |
| `font` | `default` or `mono` | text |
| `font-size` | 8–100 | text |
| `font-color` | color or gradient | text (there is no `color` key) |
| `bold`, `italic`, `underline` | `true`/`false` | text |
| `text-transform` | `none` `uppercase` `lowercase` `capitalize` | text |
| `animated` | `true`/`false` | connections (flowing dashes), shapes |
| `filled` | `true`/`false` | arrowheads (`diamond`, `circle`, `box`, `triangle`) |

## Colors

- Any CSS color name: `red`, `honeydew`, `PapayaWhip` (case-insensitive).
- Hex **must be quoted**: `fill: "#1f6feb"`. Unquoted, `#` starts a comment and
  you get `missing value after colon`.
- Gradients: `fill: "linear-gradient(#f69d3c, #3f87a6)"` or
  `radial-gradient(...)`, quoted.
- Theme color codes (`B1`, `N7`…) are **not** valid in styles; they are only
  used in `theme-overrides`.

## Connections & arrowheads

Operators: `->`, `<-`, `<->`, `--`. A label goes after a colon. A map can
follow:

```d2
a -> b: reads {
  style.stroke-dash: 3
  target-arrowhead.shape: diamond
  target-arrowhead.style.filled: true
  source-arrowhead: 1
}
```

Arrowhead shapes: `triangle` (default), `arrow`, `unfilled-triangle`,
`diamond`, `filled-diamond`, `circle`, `filled-circle`, `box`, `filled-box`,
`cross`, `line`, `none`, and the crow's-foot set `cf-one`, `cf-one-required`,
`cf-many`, `cf-many-required`. Arrowhead labels (`source-arrowhead: 1`) are not
auto-placed, so keep them to a character or two.

An arrowhead only appears on an end that has one: `source-arrowhead` on
`x -> y` does nothing. Use `<->` or `<-`.

To refer to an existing edge, use its index: `(a -> b)[0].style.stroke: red`.
Globs work too: `(* -> *)[*].style.stroke-dash: 3`, `(a -> b)[*]`.
To delete an edge: `(a -> b)[0]: null`.

Connections can carry `icon`, `link`, `tooltip`, and a Markdown/LaTeX/code
label.

## Positions (`near`)

On a top-level shape, `near` pins it to the diagram edge. This is useful for
titles, legends and notes:
`top-left`, `top-center`, `top-right`, `center-left`, `center-right`,
`bottom-left`, `bottom-center`, `bottom-right`.

```d2
title: Checkout service {
  shape: text
  near: top-center
  style.font-size: 28
  style.bold: true
}
```

`near: <shape id>` (place near another shape) needs `--layout=tala`.
`top: 100` with `left: 100` pins absolute position, also TALA only.

`label.near` and `icon.near` accept the constants above plus `center-center`,
and `outside-…` / `border-…` variants:

- `outside-top-left|center|right`
- `outside-bottom-left|center|right`
- `outside-left-top|center|bottom`
- `outside-right-top|center|bottom`
- `border-top-left|center|right`
- `border-bottom-left|center|right`
- `border-left-top|center|bottom`
- `border-right-top|center|bottom`

Note the order: it's `outside-left-center`, but `center-left`.

`tooltip.near: <constant>` shows a tooltip permanently.

## Direction

`direction: up | down | right | left` (default `down`). Set at the root. A
`direction` inside a container is honored only by TALA.

## Text blocks

Block strings start with `|lang` and end with a matching `|`. Use `||` or
`|||` when the content itself contains a pipe, such as a Markdown table.

```d2
note: |md
  # Heading
  - **bold** item
  - `code`
|
math: |latex
  \lim_{h \to 0} \frac{f(x+h)-f(x)}{h}
|
snippet: |go
  func main() { fmt.Println("hi") }
|
table: ||md
  | a | b |
  |---|---|
  | 1 | 2 |
||
```

- A Markdown block on its own renders as free text. To put Markdown *inside a
  box*, also set `shape: rectangle` (or another shape) explicitly.
- Code languages follow the Chroma highlighter. Aliases: `md` `tex` `js` `go`
  `py` `rb` `ts`.
- LaTeX: single backslashes (since 0.6.9). Use `\displaylines{a \\ b}` for line
  breaks. Size with `\large{}` etc., not `font-size`.
- In Markdown, use self-closing HTML (`<br/>`).
- `shape: text` gives plain non-Markdown text you can style with `font-size`,
  `bold` and so on.
- For a simple multi-line label in a normal shape, use `\n`:
  `x: "Line one\nline two"`.
- Variables are substituted inside Markdown blocks.

## Icons & images

```d2
api: API {icon: https://icons.d2lang.com/tech/022-server.svg}
logo: {shape: image; icon: ./assets/logo.svg}
```

- `icon` takes a URL or a path relative to the .d2 file.
- Free architecture icons (AWS, GCP, Azure, dev and tech logos) are at
  https://icons.d2lang.com. Spaces in their paths are `%20`.
- Icons are fetched at render time. Offline, the PNG shows a placeholder and
  the default bundled SVG export fails; `--bundle=false` keeps them as links.
- `icon.near: outside-top-left` and similar positions the icon.

## Links & tooltips

```d2
svc: Payments {
  link: https://wiki.example.com/payments
  tooltip: Owned by team Ledger
}
```

`link` can also point to a board (see `advanced.md`). PNG/PDF exports add an
appendix listing links and tooltips, since they are not interactive.

## Comments

`# line comment`, and block comments between lines of `"""`.

## Themes

Pick a theme with `--theme=ID` or `vars.d2-config.theme-id`. List them with
`d2 themes`.

| ID | Light theme |
|---|---|
| 0 | Neutral Default |
| 1 | Neutral Grey |
| 3 | Flagship Terrastruct |
| 4 | Cool Classics |
| 5 | Mixed Berry Blue |
| 6 | Grape Soda |
| 7 | Aubergine |
| 8 | Colorblind Clear |
| 100 | Vanilla Nitro Cola |
| 101 | Orange Creamsicle |
| 102 | Shirley Temple |
| 103 | Earth Tones |
| 104 | Everglade Green |
| 105 | Buttered Toast |
| 300 | Terminal |
| 301 | Terminal Grayscale |
| 302 | Origami |
| 303 | C4 |

Dark themes: 200 Dark Mauve, 201 Dark Flagship Terrastruct.

`--dark-theme=200` makes an SVG that switches with the viewer's OS mode. SVG
only; explicit colors you set are not adapted. Prefer theme colors when dark
mode matters. `--sketch` gives a hand-drawn look with any theme.

## `d2-config` (in-file settings)

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 4
    dark-theme-id: 200
    sketch: true
    pad: 20
    center: true
    theme-overrides: {
      B1: "#0B3D91"
      B2: "#1F6FEB"
    }
  }
}
```

Keys: `layout-engine`, `theme-id`, `dark-theme-id`, `sketch`, `pad`, `center`,
`theme-overrides`, `dark-theme-overrides`, `data` (free-form, for plugins).
CLI flags and environment variables override these.

`theme-overrides` color codes:

- neutrals `N1`–`N7` (dark to light)
- base `B1`–`B6`
- alternates `AA2` `AA4` `AA5` `AB4` `AB5`

## Root styles

At the top level, `style.fill` sets the background. `style.stroke`,
`stroke-width`, `stroke-dash` and `double-border` draw a frame around the
diagram. `fill-pattern` also works. Add `--pad` if you draw a frame.
