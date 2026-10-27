import { describe, expect, it } from "vitest";

import { entityLabel, ORIGIN_ID, plan, type Entity, type Migration } from "./merge.js";

const table = (name: string): Entity => ({ entityType: "tables", schema: "dbo", name });
const column = (tableName: string, name: string, extra: Record<string, unknown> = {}): Entity => ({
  entityType: "columns",
  schema: "dbo",
  table: tableName,
  name,
  type: "int",
  notNull: false,
  ...extra,
});

function migration(folder: string, id: string, prevIds: string[], ddl: Entity[]): Migration {
  return { folder, snapshot: { version: "2", dialect: "mssql", id, prevIds, ddl, renames: [] } };
}

const users = [table("users"), column("users", "id")];
const init = migration("001_init", "I", [ORIGIN_ID], users);

describe("plan", () => {
  it("leaves a straight history alone", () => {
    const next = migration("002_posts", "P", ["I"], [...users, table("posts")]);
    expect(plan([init, next])).toEqual({ rewrites: [], conflicts: [], warnings: [] });
  });

  it("adds the earlier branch's table to the later branch's snapshot", () => {
    const posts = migration("002_posts", "P", ["I"], [...users, table("posts"), column("posts", "id")]);
    const orders = migration("003_orders", "O", ["I"], [...users, table("orders")]);
    const { rewrites, conflicts } = plan([init, orders, posts]);

    expect(conflicts).toEqual([]);
    expect(rewrites).toHaveLength(1);
    const [r] = rewrites;
    expect(r!.folder).toBe("003_orders");
    expect(r!.basedOn).toBe("001_init");
    expect(r!.rebasedOnto).toBe("002_posts");
    expect(r!.snapshot.prevIds).toEqual(["P"]);
    expect(r!.snapshot.ddl.map(entityLabel).sort()).toEqual(
      ["tables dbo.users", "columns dbo.users.id", "tables dbo.orders", "tables dbo.posts", "columns dbo.posts.id"].sort(),
    );
    expect(r!.changes.map((c) => `${c.kind} ${entityLabel(c.entity)}`)).toEqual([
      "add tables dbo.posts",
      "add columns dbo.posts.id",
    ]);
  });

  it("carries the merge into the later branch's own children", () => {
    const posts = migration("002_posts", "P", ["I"], [...users, table("posts")]);
    const orders = migration("003_orders", "O", ["I"], [...users, table("orders")]);
    const more = migration("004_orders_total", "T", ["O"], [...users, table("orders"), column("orders", "total")]);
    const { rewrites } = plan([init, posts, orders, more]);

    expect(rewrites.map((r) => r.folder)).toEqual(["003_orders", "004_orders_total"]);
    expect(rewrites[1]!.snapshot.prevIds).toEqual(["O"]);
    expect(rewrites[1]!.snapshot.ddl.map(entityLabel)).toContain("tables dbo.posts");
  });

  it("is a no-op on its own output", () => {
    const posts = migration("002_posts", "P", ["I"], [...users, table("posts")]);
    const orders = migration("003_orders", "O", ["I"], [...users, table("orders")]);
    const once = plan([init, posts, orders]);
    const rewritten = [init, posts, ...once.rewrites.map((r) => ({ folder: r.folder, snapshot: r.snapshot }))];
    expect(plan(rewritten).rewrites).toEqual([]);
  });

  it("merges changes to different fields of different entities", () => {
    const a = migration("002_a", "A", ["I"], [table("users"), column("users", "id", { notNull: true })]);
    const b = migration("003_b", "B", ["I"], [...users, column("users", "age")]);
    const { rewrites, conflicts } = plan([init, a, b]);
    expect(conflicts).toEqual([]);
    expect(rewrites[0]!.changes).toEqual([
      { kind: "alter", entity: column("users", "id", { notNull: true }), fields: [{ field: "notNull", from: false, to: true }] },
    ]);
  });

  it("accepts the same change made on both branches", () => {
    const a = migration("002_a", "A", ["I"], [...users, column("users", "age")]);
    const b = migration("003_b", "B", ["I"], [...users, column("users", "age")]);
    expect(plan([init, a, b]).conflicts).toEqual([]);
  });

  it("reports one entity changed differently on both branches", () => {
    const a = migration("002_a", "A", ["I"], [table("users"), column("users", "id", { type: "bigint" })]);
    const b = migration("003_b", "B", ["I"], [table("users"), column("users", "id", { notNull: true })]);
    expect(plan([init, a, b]).conflicts).toEqual([
      { folder: "003_b", entity: "columns dbo.users.id", reason: expect.stringContaining("changed") },
    ]);
  });

  it("reports a column added to a table the other branch dropped", () => {
    const withPosts = migration("002_posts", "P", ["I"], [...users, table("posts")]);
    const drop = migration("003_drop", "D", ["P"], users);
    const add = migration("004_add", "X", ["P"], [...users, table("posts"), column("posts", "title")]);
    expect(plan([init, withPosts, drop, add]).conflicts).toEqual([
      { folder: "004_add", entity: "columns dbo.posts.title", reason: "refers to table dbo.posts, which one side dropped" },
    ]);
  });

  it("warns about a snapshot generated with several parents", () => {
    const a = migration("002_a", "A", ["I"], [...users, table("a")]);
    const b = migration("003_b", "B", ["I"], [...users, table("b")]);
    const c = migration("004_c", "C", ["A", "B"], [...users, table("a"), table("b")]);
    const { warnings, conflicts } = plan([init, a, b, c]);
    expect(conflicts).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining("004_c was generated with several parents")]);
  });

  it("rejects a parent that is not in the folder", () => {
    expect(() => plan([init, migration("002_a", "A", ["missing"], users)])).toThrow("parent snapshot missing");
  });

  it("rejects snapshots that are not mssql version 2", () => {
    const old = { folder: "001", snapshot: { ...init.snapshot, version: "1" } };
    expect(() => plan([old])).toThrow("drizzle-kit up");
  });
});
