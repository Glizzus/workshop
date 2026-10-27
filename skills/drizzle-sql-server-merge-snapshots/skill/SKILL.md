---
name: drizzle-sql-server-merge-snapshots
description: Fix drizzle-kit v1 mssql snapshot.json files after a git merge or rebase brings in migrations generated on another branch, so the next drizzle-kit generate does not re-emit the other branch's changes. Use when a project whose drizzle.config.ts has dialect "mssql" has migrations from two branches, or generate produced statements for tables or columns another branch already created.
compatibility: drizzle-kit 1.0.0-beta (snapshot version 2, dialect mssql). Needs Node 22 or newer.
---

# drizzle-sql-server-merge-snapshots

For mssql, drizzle-kit 1.0.0-beta `generate` diffs the schema against the snapshot of the migration folder that sorts last and runs no branch-conflict check. Merge two branches that each added a migration and the last folder's snapshot lacks the other branch's changes, so the next `generate` emits them again.

`merge-snapshots` rewrites each `snapshot.json` so that, in folder order, it equals the previous snapshot plus its own changes, and its `prevIds` names only the previous folder. It never touches `migration.sql`; the SQL of each migration is already right when the folders run in order.

## Use

1. Merge or rebase so all migration folders are present. Resolve any git conflict in a `snapshot.json` by taking that branch's file whole; this tool redoes the merge.
2. Dry run, from the directory holding the migrations folder:
   `node <this skill>/scripts/merge-snapshots.js ./drizzle`
   It prints each snapshot that would change: `+` entities it gains, `-` it loses, `~` altered fields, and its `prevIds` before and after. Exit 2 means changes are pending.
3. Show the user that output. On their go-ahead, rerun with `--write`. Then `git diff` shows the same changes in the files.
4. Run the project's generate command. With no schema changes since the merge it should report nothing to migrate.

## Old history

If it fails on migrations older than the branches you merged, rerun with `--onto <folder>`, naming the last migration folder before either branch's work. That folder and everything before it are left alone. If it says a migration forked before that folder, use the folder it names.

## When it refuses

It writes nothing and exits 1 when two migrations changed the same entity in different ways, or one dropped a table or column the other used. That is a real schema conflict: delete the later branch's migration folder, merge the schema in TypeScript, and generate again on top.

A warning about a snapshot with several parents means someone already ran generate after the merge. That migration's SQL was diffed against only one branch: read it for repeated or missing statements.
