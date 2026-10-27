#!/usr/bin/env node
// Rebases the snapshot.json files of a drizzle-kit v1 mssql migrations folder
// into one straight line after branches are merged, and prints what changed
// per snapshot. Dry run unless --write is given; refuses to write anything
// when two migrations changed the same entity.
//
//   merge-snapshots [migrations-dir] [--write]
//
// migrations-dir defaults to ./drizzle. Exit 0 when nothing needs changing or
// the rewrite was saved, 1 on a conflict or error, 2 when a dry run found
// snapshots to rewrite.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { entityLabel, ORIGIN_ID, plan, type Change, type Migration, type Snapshot } from "./merge.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { write: { type: "boolean", default: false } },
});
const dir = positionals[0] ?? "./drizzle";

const color = process.stdout.isTTY && !process.env["NO_COLOR"];
const paint = (code: number) => (s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = paint(32);
const red = paint(31);
const yellow = paint(33);
const dim = paint(2);
const bold = paint(1);

function fail(message: string): never {
  process.stderr.write(`merge-snapshots: ${message}\n`);
  process.exit(1);
}

if (!existsSync(dir)) fail(`${dir} does not exist`);
if (existsSync(join(dir, "meta/_journal.json"))) fail(`${dir} uses the pre-v1 layout; run drizzle-kit up first`);

const migrations: Migration[] = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "snapshot.json")))
  .map((d) => ({
    folder: d.name,
    snapshot: JSON.parse(readFileSync(join(dir, d.name, "snapshot.json"), "utf8")) as Snapshot,
  }));

let result;
try {
  result = plan(migrations);
} catch (e) {
  fail((e as Error).message);
}
const { rewrites, conflicts, warnings } = result;

if (conflicts.length > 0) {
  for (const c of conflicts) process.stderr.write(red(`conflict: ${c.folder}: ${c.entity} ${c.reason}\n`));
  fail(
    `${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}, nothing written. ` +
      `Delete the later branch's migration folder and run drizzle-kit generate again.`,
  );
}

const folderOf = new Map(migrations.map((m) => [m.snapshot.id, m.folder]));
const ids = (list: string[]) =>
  list.map((id) => (id === ORIGIN_ID ? "(empty database)" : (folderOf.get(id) ?? id))).join(", ");
const show = (v: unknown) => (v === undefined ? "undefined" : JSON.stringify(v));

function line(change: Change): string {
  const label = entityLabel(change.entity);
  switch (change.kind) {
    case "add":
      return green(`  + ${label}`);
    case "remove":
      return red(`  - ${label}`);
    case "alter":
      return [
        yellow(`  ~ ${label}`),
        ...change.fields.map((f) => `      ${f.field}: ${red(show(f.from))} -> ${green(show(f.to))}`),
      ].join("\n");
  }
}

const out: string[] = [];
for (const r of rewrites) {
  out.push(bold(join(dir, r.folder, "snapshot.json")));
  out.push(dim(`  generated on: ${r.basedOn ?? "(empty database)"}`));
  out.push(dim(`  now follows:  ${r.rebasedOnto ?? "(empty database)"}`));
  const after = r.snapshot.prevIds;
  if (ids(r.prevIdsBefore) !== ids(after)) out.push(`  prevIds: ${red(ids(r.prevIdsBefore))} -> ${green(ids(after))}`);
  for (const c of r.changes) out.push(line(c));
  out.push("");
}
for (const w of warnings) out.push(yellow(`warning: ${w}`));
process.stdout.write(out.join("\n") + (out.length ? "\n" : ""));

if (rewrites.length === 0) {
  process.stdout.write("Snapshots already form a straight line; nothing to do.\n");
} else if (!values.write) {
  process.stdout.write(`${rewrites.length} snapshot(s) would change. Run again with --write to save them.\n`);
  process.exitCode = 2;
} else {
  for (const r of rewrites) {
    writeFileSync(join(dir, r.folder, "snapshot.json"), JSON.stringify(r.snapshot, null, 2));
  }
  process.stdout.write(`Wrote ${rewrites.length} snapshot(s). migration.sql files were not touched.\n`);
}
