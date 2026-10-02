import { describe, expect, it } from "vitest";

import { cloneDir, runDir, worktreeDir } from "./layout.js";

describe("layout", () => {
  it("puts everything under the root", () => {
    expect(cloneDir("/root")).toBe("/root/repo.git");
    expect(worktreeDir("/root", "PROJ-12")).toBe("/root/wt-PROJ-12");
    expect(runDir("/root", "2026-10-01", "PROJ-12")).toBe("/root/runs/2026-10-01/PROJ-12");
  });

  it.each(["PROJ-1", "A1-2", "AB_C-10"])("accepts the issue key %s", (key) => {
    expect(worktreeDir("/root", key)).toBe(`/root/wt-${key}`);
    expect(runDir("/root", "2026-10-01", key)).toBe(`/root/runs/2026-10-01/${key}`);
  });

  // The key comes from Jira, not from the operator, and becomes a path segment.
  it.each(["proj-1", "PROJ-", "PROJ-1a", "1PROJ-2", "../etc", "", "PROJ-1/../..", "PROJ 1"])(
    "refuses to build a path from %j",
    (key) => {
      expect(() => worktreeDir("/root", key)).toThrow(/not a Jira issue key/);
      expect(() => runDir("/root", "2026-10-01", key)).toThrow(/not a Jira issue key/);
    },
  );
});
