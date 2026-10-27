// Rebases drizzle-kit v1 mssql snapshots into one straight line.
//
// drizzle-kit generate for mssql diffs the schema against the snapshot of the
// migration folder that sorts last, and never checks branches against each
// other. After two branches that each added a migration are merged, the
// last folder's snapshot is missing the other branch's changes, so the next
// generate emits them again. This module rewrites each snapshot so that it
// equals its predecessor in folder order plus its own changes, the way a git
// rebase replays a commit onto a new parent. migration.sql is never touched.

/** Parent id drizzle-kit gives the first snapshot in a folder. */
export const ORIGIN_ID = "00000000-0000-0000-0000-000000000000";

/** One entry of a snapshot's `ddl` array: a table, column, index, and so on. */
export interface Entity {
  entityType: string;
  schema?: string | null;
  table?: string | null;
  name: string;
  [field: string]: unknown;
}

export interface Snapshot {
  version: string;
  dialect: string;
  id: string;
  prevIds: string[];
  ddl: Entity[];
  [field: string]: unknown;
}

/** A migration folder: its name (which sets the order) and its snapshot. */
export interface Migration {
  folder: string;
  snapshot: Snapshot;
}

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export type Change =
  | { kind: "add"; entity: Entity }
  | { kind: "remove"; entity: Entity }
  | { kind: "alter"; entity: Entity; fields: FieldChange[] };

export interface Rewrite {
  folder: string;
  /** Folder the snapshot was generated on top of, or null for an empty database. */
  basedOn: string | null;
  /** Folder it now follows, or null when it is first. */
  rebasedOnto: string | null;
  prevIdsBefore: string[];
  snapshot: Snapshot;
  changes: Change[];
}

export interface Conflict {
  folder: string;
  entity: string;
  reason: string;
}

export interface Plan {
  rewrites: Rewrite[];
  conflicts: Conflict[];
  warnings: string[];
}

/** Identity drizzle-kit uses for an entity: its type, schema, table, and name. */
export function entityKey(e: Entity): string {
  return JSON.stringify([e.entityType, e.schema ?? null, e.table ?? null, e.name]);
}

/** "columns dbo.users.email" */
export function entityLabel(e: Entity): string {
  const path = [e.schema, e.table, e.name].filter((p) => p != null && p !== "").join(".");
  return `${e.entityType} ${path}`;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

function same(a: Entity | undefined, b: Entity | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return canonical(a) === canonical(b);
}

function byKey(ddl: Entity[]): Map<string, Entity> {
  return new Map(ddl.map((e) => [entityKey(e), e]));
}

/**
 * Three-way merge of snapshot ddl. `base` is what `theirs` was generated on
 * top of; `ours` is what it should now sit on top of. An entity changed on
 * only one side takes that side; changed identically on both is fine;
 * changed differently on both is a conflict. Keeps `theirs`' order and
 * appends entities only `ours` has.
 */
export function mergeDdl(
  base: Entity[],
  ours: Entity[],
  theirs: Entity[],
): { ddl: Entity[]; conflicts: { entity: string; reason: string }[] } {
  const b = byKey(base);
  const o = byKey(ours);
  const t = byKey(theirs);
  const conflicts: { entity: string; reason: string }[] = [];

  const pick = (key: string): Entity | undefined => {
    const bv = b.get(key);
    const ov = o.get(key);
    const tv = t.get(key);
    if (same(ov, tv)) return tv;
    if (same(bv, tv)) return ov;
    if (same(bv, ov)) return tv;
    const label = entityLabel((tv ?? ov ?? bv)!);
    const describe = (v: Entity | undefined) => (v === undefined ? (bv ? "dropped" : "absent") : bv ? "changed" : "added");
    conflicts.push({
      entity: label,
      reason: `${describe(ov)} on the earlier migration, ${describe(tv)} differently on this one`,
    });
    return tv;
  };

  const ddl: Entity[] = [];
  for (const key of t.keys()) {
    const v = pick(key);
    if (v) ddl.push(v);
  }
  for (const key of o.keys()) {
    if (t.has(key)) continue;
    const v = pick(key);
    if (v) ddl.push(v);
  }

  // An entity can merge cleanly on its own yet point at something the other
  // side dropped: a column added to a table the other branch removed.
  const before = new Set([...danglingRefs(ours), ...danglingRefs(theirs)].map((r) => `${r.entity} ${r.target}`));
  for (const r of danglingRefs(ddl)) {
    if (!before.has(`${r.entity} ${r.target}`)) {
      conflicts.push({ entity: r.entity, reason: `refers to ${r.target}, which one side dropped` });
    }
  }

  return { ddl, conflicts };
}

/** References from an entity to a table or column that is not in the ddl. */
function danglingRefs(ddl: Entity[]): { entity: string; target: string }[] {
  const tables = new Set<string>();
  const columns = new Set<string>();
  for (const e of ddl) {
    if (e.entityType === "tables") tables.add(`${e.schema}.${e.name}`);
    if (e.entityType === "columns") columns.add(`${e.schema}.${e.table}.${e.name}`);
  }
  const out: { entity: string; target: string }[] = [];
  const need = (e: Entity, set: Set<string>, target: string, kind: string) => {
    if (!set.has(target)) out.push({ entity: entityLabel(e), target: `${kind} ${target}` });
  };
  for (const e of ddl) {
    if (e.table == null || e.entityType === "tables") continue;
    const table = `${e.schema}.${e.table}`;
    need(e, tables, table, "table");
    const cols: string[] = [];
    if (Array.isArray(e["columns"])) {
      for (const c of e["columns"] as unknown[]) {
        if (typeof c === "string") cols.push(c);
        else if (c && typeof c === "object" && !(c as { isExpression?: boolean }).isExpression) {
          cols.push(String((c as { value: unknown }).value));
        }
      }
    }
    if (e.entityType === "defaults" && typeof e["column"] === "string") cols.push(e["column"]);
    for (const c of cols) need(e, columns, `${table}.${c}`, "column");
    if (e.entityType === "fks") {
      const toTable = `${e["schemaTo"]}.${e["tableTo"]}`;
      need(e, tables, toTable, "table");
      for (const c of (e["columnsTo"] as string[] | undefined) ?? []) need(e, columns, `${toTable}.${c}`, "column");
    }
  }
  return out;
}

/** What `after` adds, removes, and alters relative to `before`. */
export function diffDdl(before: Entity[], after: Entity[]): Change[] {
  const b = byKey(before);
  const a = byKey(after);
  const changes: Change[] = [];
  for (const [key, e] of b) if (!a.has(key)) changes.push({ kind: "remove", entity: e });
  for (const [key, e] of a) {
    const prev = b.get(key);
    if (!prev) {
      changes.push({ kind: "add", entity: e });
      continue;
    }
    if (same(prev, e)) continue;
    const fields: FieldChange[] = [];
    for (const field of new Set([...Object.keys(prev), ...Object.keys(e)])) {
      if (canonical(prev[field]) !== canonical(e[field])) fields.push({ field, from: prev[field], to: e[field] });
    }
    changes.push({ kind: "alter", entity: e, fields });
  }
  return changes;
}

/**
 * Plans the rewrite of every snapshot so that, in folder-name order, each one
 * has the previous folder as its only parent and contains everything before
 * it. Returns only the snapshots that change. Writes nothing.
 *
 * With `onto`, that folder and everything before it are trusted as-is and
 * only the folders after it are rewritten, so broken old history is skipped.
 */
export function plan(migrations: Migration[], onto?: string): Plan {
  const sorted = [...migrations].sort((x, y) => (x.folder < y.folder ? -1 : x.folder > y.folder ? 1 : 0));
  const position = new Map(sorted.map((m, i) => [m.snapshot.id, i]));
  const rewrites: Rewrite[] = [];
  const conflicts: Conflict[] = [];
  const warnings: string[] = [];

  const start = onto === undefined ? 0 : sorted.findIndex((m) => m.folder === onto) + 1;
  if (onto !== undefined && start === 0) throw new Error(`--onto ${onto}: no such migration folder`);
  const anchor = sorted[start - 1];
  let prev: { migration: Migration; ddl: Entity[] } | undefined = anchor && { migration: anchor, ddl: anchor.snapshot.ddl };
  for (const [i, m] of sorted.entries()) {
    if (i < start) continue;
    const { snapshot } = m;
    if (snapshot.dialect !== "mssql") throw new Error(`${m.folder}: dialect is "${snapshot.dialect}", expected "mssql"`);
    if (snapshot.version !== "2") {
      throw new Error(`${m.folder}: snapshot version "${snapshot.version}" is not 2; run drizzle-kit up first`);
    }

    // drizzle-kit diffed this migration against the last snapshot in its
    // folder at the time, which is the parent that sorts last.
    let base: Migration | undefined;
    for (const id of snapshot.prevIds) {
      if (id === ORIGIN_ID) {
        if (anchor) throw new Error(`${m.folder}: generated on an empty database, before --onto ${onto}; run without --onto`);
        continue;
      }
      const at = position.get(id);
      if (at === undefined) throw new Error(`${m.folder}: parent snapshot ${id} is not in the folder`);
      if (at >= i) throw new Error(`${m.folder}: parent ${sorted[at]!.folder} sorts after it; rename one of the folders`);
      // Its branch forked before the anchor, so the anchor lacks that
      // branch's earlier changes and the merge would drop them.
      if (at < start - 1) {
        const fork = sorted[at]!.folder;
        throw new Error(`${m.folder}: forked at ${fork}, before --onto ${onto}; use --onto ${fork} or earlier`);
      }
      if (!base || at > position.get(base.snapshot.id)!) base = sorted[at];
    }
    if (snapshot.prevIds.length > 1) {
      warnings.push(
        `${m.folder} was generated with several parents, so its migration.sql was diffed against ` +
          `${base?.folder ?? "an empty database"} only. Check that it does not repeat or miss another branch's statements.`,
      );
    }

    const ours = prev?.ddl ?? [];
    const merged = mergeDdl(base?.snapshot.ddl ?? [], ours, snapshot.ddl);
    for (const c of merged.conflicts) conflicts.push({ folder: m.folder, ...c });

    const prevIds = [prev?.migration.snapshot.id ?? ORIGIN_ID];
    const changes = diffDdl(snapshot.ddl, merged.ddl);
    if (changes.length > 0 || canonical(prevIds) !== canonical(snapshot.prevIds)) {
      rewrites.push({
        folder: m.folder,
        basedOn: base?.folder ?? null,
        rebasedOnto: prev?.migration.folder ?? null,
        prevIdsBefore: snapshot.prevIds,
        snapshot: { ...snapshot, prevIds, ddl: merged.ddl },
        changes,
      });
    }
    prev = { migration: m, ddl: merged.ddl };
  }

  return { rewrites, conflicts, warnings };
}
