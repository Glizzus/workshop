import { describe, expect, it } from "vitest";

import { parseWorktreeList } from "./worktree-list.js";

describe("parseWorktreeList", () => {
  it("parses bare, locked, and prunable flags and ignores unknown attributes", () => {
    const out = parseWorktreeList(
      [
        "worktree /repo.git",
        "bare",
        "",
        "worktree /wt/x",
        "HEAD 0123",
        "detached",
        "locked reason here",
        "prunable gitdir file points to non-existent location",
        "futureattr value",
        "",
      ].join("\n"),
    );
    expect(out).toEqual([
      { path: "/repo.git", head: undefined, branch: undefined, detached: false, bare: true, locked: false, prunable: false },
      { path: "/wt/x", head: "0123", branch: undefined, detached: true, bare: false, locked: true, prunable: true },
    ]);
  });

  it("returns nothing for empty output and handles a missing trailing newline", () => {
    expect(parseWorktreeList("")).toEqual([]);
    expect(parseWorktreeList("worktree /a\nHEAD 1").map((w) => w.head)).toEqual(["1"]);
  });
});
