# D2 recipes

Tested starting points (v0.9.0). Copy the closest one, rename, then run the
checker and look at the PNG. Each recipe lists the quirks specific to that
diagram type.

Contents: Architecture · Flowchart · Sequence · ER / SQL schema · UML class ·
Grid & layered stack · C4-style · Converting from Mermaid

---

## Architecture / system diagram

```d2
vars: {d2-config: {layout-engine: elk}}
direction: right

classes: {
  svc: {shape: hexagon}
  store: {shape: cylinder}
  ext: {style.stroke-dash: 3}
}

user: Customer {shape: person}

edge: Edge {
  cdn: CDN
  lb: Load balancer
}

core: Core services {
  api: API gateway {class: svc}
  orders: Orders {class: svc}
  billing: Billing {class: svc}
  api -> orders
  api -> billing
}

data: Data {
  pg: PostgreSQL {class: store}
  cache: Redis {shape: stored_data}
  bus: Event bus {shape: queue}
}

stripe: Stripe API {class: ext}

user -> edge.cdn: HTTPS
edge.cdn -> edge.lb
edge.lb -> core.api
core.orders -> data.pg: SQL
core.orders -> data.cache: read-through
core.orders -> data.bus: OrderPlaced
data.bus -> core.billing: consume
core.billing -> stripe: charge
```

Quirks:

- **Write cross-container connections at the level that can see both ends**,
  using full paths (`core.orders -> data.pg`). Writing `orders -> pg` inside
  `core` would create a new `core.pg`.
- **Containers are the boundary story.** Use 2–3 levels at most. If a
  container holds one shape, drop the container.
- **Use ELK here.** With containers and cross-container edges, the default
  dagre layout tangled this exact diagram; ELK routed it cleanly left to
  right. Try TALA when you need per-container `direction` or `near`, and
  compare the PNGs. Don't assume one engine is best.

---

## Flowchart

```d2
direction: down

start: Order received {shape: oval}
check: In stock? {shape: diamond}
reserve: Reserve items
backorder: Create backorder
pay: Payment OK? {shape: diamond}
ship: Ship order
cancel: Cancel & notify
done: Done {shape: oval}

start -> check
check -> reserve: yes
check -> backorder: no
backorder -> check: restocked {style.stroke-dash: 3}
reserve -> pay
pay -> ship: yes
pay -> cancel: no
ship -> done
cancel -> done
```

Quirks:

- **Give every decision branch a label.** Keep decision text short; it has
  to fit in a diamond.
- **Loops are fine** (`backorder -> check`). Dashing the back-edge helps it
  read as a return path.
- **Very wide flowcharts** read better with `direction: right`.

---

## Sequence diagram

```d2
shape: sequence_diagram

# Declare actors first: this fixes their left-to-right order AND is required
# for any actor used inside a group.
client: Browser
api: API
auth: Auth service
db: Database {shape: cylinder}

client -> api: POST /login
api -> auth: verify(credentials)
auth -> db: SELECT user
db -> auth: row
auth -> api: token {style.stroke-dash: 3}

retry: "alt: token expired" {
  api -> auth: refresh(token)
  auth -> api: new token {style.stroke-dash: 3}
}

api -> api: cache session
api."Session TTL 15 min"
api -> client: 200 OK + cookie {style.stroke-dash: 3}
```

How the pieces map:

| UML idea | D2 |
|---|---|
| participant | top-level child, e.g. `api` |
| message | `a -> b: text`. Order in the file is order on the page. |
| reply | same arrow reversed. Dashing is a style choice: `{style.stroke-dash: 3}`. |
| fragment / alt / loop / group | a container that is not connected to anything: `name: label { ... }` |
| note | a nested child of an actor with no connections: `api."text"` |
| activation / span | connect via a nested child: `client.t1 -> api.t1` |
| self-message | `api -> api: text` |

Quirks:

- **Declare actors before any group.** Inside a group, a name refers to the
  top-level actor only if the actor already exists. Otherwise the group itself
  silently becomes an actor and the messages turn into its spans. Look at the
  PNG to confirm groups render as shaded frames.
- **All children share one scope.** `alice` inside a group is the same
  `alice` as at the top.
- **Spans are easy to create by accident.** Any dotted name on an actor
  (`api.t1`) is a span or a note, so don't use dots in actor names unless you
  quote them.
- **Order matters here** and nowhere else in D2.
- **UML-style group labels need quotes.** `alt [token expired]` has brackets,
  so write `retry: "alt [token expired]" {`.

---

## ER diagram / SQL schema

```d2
vars: {d2-config: {layout-engine: elk}}
direction: right

users: {
  shape: sql_table
  id: uuid {constraint: primary_key}
  email: varchar(255) {constraint: unique}
  created_at: timestamptz
}

orders: {
  shape: sql_table
  id: uuid {constraint: primary_key}
  user_id: uuid {constraint: foreign_key}
  status: order_status
  total_cents: int
}

order_items: {
  shape: sql_table
  order_id: uuid {constraint: [primary_key; foreign_key]}
  sku: text {constraint: [primary_key; foreign_key]}
  qty: int
}

products: {
  shape: sql_table
  sku: text {constraint: primary_key}
  name: text
}

orders.user_id <-> users.id: {
  source-arrowhead.shape: cf-many
  target-arrowhead.shape: cf-one-required
}
order_items.order_id <-> orders.id: {
  source-arrowhead.shape: cf-many
  target-arrowhead.shape: cf-one-required
}
order_items.sku <-> products.sku: {
  source-arrowhead.shape: cf-many
  target-arrowhead.shape: cf-one-required
}
```

Quirks:

- **Rows are written as `name: type {constraint: ...}`.**
  - Known constraints are abbreviated: `primary_key`→PK, `foreign_key`→FK,
    `unique`→UNQ.
  - Any other text is shown as written.
  - Use an array for several constraints.
- **Don't write SQL in a row.** `id: int PRIMARY KEY NOT NULL` makes D2 drop
  the row. Put modifiers in `constraint`.
- **Connect row to row** (`orders.user_id -> users.id`). ELK and TALA attach
  the edge to the exact row; dagre only attaches to the table.
- **Crow's-foot arrowheads**: `cf-one`, `cf-one-required`, `cf-many`,
  `cf-many-required`. Use `<->` so that **both** ends draw: on `->`, the
  `source-arrowhead` is silently dropped.
- **Quote reserved words used as column names**: `"label": text`,
  `"width": int`.
- **Type text**: types with square brackets, `#`, `;` or `$` need quotes
  (`tags: "text[]"`). Parentheses and commas are fine (`numeric(10,2)`).

---

## UML class diagram

```d2
direction: up

base: "Shape" {
  shape: class
  +name: string
  \#id: int
  +area(): float
  +draw(ctx Canvas)
}

Circle: {
  shape: class
  -radius: float
  +area(): float
}

Rect: {
  shape: class
  -w: float
  -h: float
  +area(): float
}

Circle -> base: {target-arrowhead: {shape: triangle; style.filled: false}}
Rect -> base: {target-arrowhead: {shape: triangle; style.filled: false}}
```

Quirks:

- **Fields and methods.**
  - A key containing `(` is a method; its value is the return type. No value
    means void.
  - Other keys are fields, with the value as the type.
- **Visibility prefixes**: `+` public, `-` private, `\#` protected. The `#`
  must be escaped, or it starts a comment.
- **Quote awkward types**: `items: "[]string"`, `m: "map[string]int"`.
- **Don't name a class after a keyword.** Keywords match in any casing, so a
  class ID of `Shape`, `Label`, `Link`, `Style` or `Width` errors. Use another
  ID with the word as its label, as `base: "Shape"` does above. Quote that
  label: `d2 fmt` lowercases an unquoted label that spells a keyword.
- **UML arrowheads**:
  - inheritance: hollow `triangle` (`style.filled: false`)
  - composition: `filled-diamond`
  - aggregation: `diamond`

---

## Grid & layered stack

Grids place children in rows and columns, which makes them good for layered
architectures, comparison tables and dashboards. The first of `grid-rows` /
`grid-columns` you write sets the fill order.

```d2
stack: Platform {
  grid-columns: 1
  grid-gap: 0
  ui: Web & mobile clients
  api: API layer {
    grid-columns: 3
    rest: REST
    gql: GraphQL
    ws: WebSockets
  }
  svc: Domain services
  infra: Kubernetes · Postgres · Kafka
}
stack.ui.style.fill: "#e8f0fe"
stack.infra.style.fill: "#f1f3f4"
```

Quirks:

- **Spacing**: `grid-gap: 0` makes tiles touch. `vertical-gap` and
  `horizontal-gap` override it per axis.
- **Cell sizes**: set `width`/`height` on cells to make them span or align.
  Pad with invisible cells (`style.opacity: 0`, `label: ""`) to center things.
- **Connections between cells**: dagre and ELK draw them as straight lines
  with no routing; TALA routes them.
- **Plain data tables**: a `||md` table block is usually simpler than a grid.

---

## C4-style

```d2
vars: {d2-config: {theme-id: 303}}
direction: down

customer: "Customer\n[Person]\nBuys products online" {shape: c4-person}

shop: "Online Shop\n[Software System]" {
  web: "Web App\n[Container: React SPA]"
  api: "API\n[Container: Go]"
  db: "Database\n[Container: PostgreSQL]" {shape: cylinder}
  web -> api: "JSON/HTTPS"
  api -> db: SQL
}

email: "Email System\n[External System]" {style.stroke-dash: 3}

customer -> shop.web: Uses
shop.api -> email: Sends receipts
```

Quirks:

- **Theme**: theme `303` (C4) gives the C4 palette, and `c4-person` gives the
  C4 person shape.
- **Levels**: show context, containers and components as separate `layers`
  (see `advanced.md`), linked with `link: layers.containers`, rather than one
  big board.

---

## Converting from Mermaid

| Mermaid | D2 |
|---|---|
| `flowchart LR` | `direction: right` (`TD` → `down`, `RL` → `left`, `BT` → `up`) |
| `A[Label]` | `A: Label` |
| `A((x))` / `A{x}` / `A[(x)]` | `A: x {shape: circle}` / `{shape: diamond}` / `{shape: cylinder}` |
| `A --> B` | `A -> B` |
| `A -- text --> B`, `A -->\|text\| B` | `A -> B: text` |
| `A --- B` | `A -- B` |
| `A -.-> B` | `A -> B: {style.stroke-dash: 3}` |
| `A ==> B` | `A -> B: {style.stroke-width: 4}` |
| `subgraph X ... end` | `X: { ... }`. Then refer to members as `X.A` from outside it. |
| `classDef c fill:#f9f` + `class A c` | `classes: {c: {style.fill: "#f99"}}` + `A.class: c` |
| `sequenceDiagram` + `participant A` | `shape: sequence_diagram` + `A` (declare first) |
| `loop` / `alt` ... `end` | a group container: `l: loop {...}` |
| `Note over A: x` | `A."x"` |
| `erDiagram` | `sql_table` shapes + crow's-foot arrowheads (see above) |
| `classDiagram` | `shape: class` (see above) |

**Watch the subgraph scope.** Mermaid node IDs are global, but D2 names are
scoped to their container. After moving nodes into a container, update every
connection written outside it to the full path (`X.A`).
