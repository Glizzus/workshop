import { describe, expect, it } from "vitest";

import { buildJql, handledKeys, selectNext } from "./select.js";

/** A pull request, reduced to what `handledKeys` reads. */
function pull(ref: string): { head: { ref: string } } {
  return { head: { ref } };
}

describe("selectNext", () => {
  it("takes the first key not to be skipped, keeping Jira's order", () => {
    const keys = ["PROJ-1", "PROJ-2", "PROJ-3"];
    expect(selectNext(keys, new Set())).toBe("PROJ-1");
    expect(selectNext(keys, new Set(["PROJ-1"]))).toBe("PROJ-2");
    expect(selectNext(keys, new Set(["PROJ-1", "PROJ-2"]))).toBe("PROJ-3");
  });

  it("returns nothing when there is nothing left", () => {
    expect(selectNext([], new Set())).toBeUndefined();
    expect(selectNext(["PROJ-1"], new Set(["PROJ-1"]))).toBeUndefined();
  });
});

describe("handledKeys", () => {
  const keys = ["PROJ-1", "PROJ-2", "PROJ-3", "PROJ-12"];

  it("counts an issue with a pull request, whatever became of it, by the key in its branch", () => {
    const pulls = [pull("feature/PROJ-1"), pull("feature/PROJ-2-health-endpoint"), pull("proj-3_fix")];
    expect(handledKeys(keys, pulls, {})).toEqual(new Set(["PROJ-1", "PROJ-2", "PROJ-3"]));
  });

  it("does not mistake a longer or embedded key for the issue", () => {
    expect(handledKeys(keys, [pull("feature/PROJ-12")], {})).toEqual(new Set(["PROJ-12"]));
    expect(handledKeys(keys, [pull("XPROJ-1"), pull("MY_PROJ-1"), pull("PROJ_1")], {})).toEqual(new Set());
  });

  it("ignores pull requests that name no issue", () => {
    expect(handledKeys(keys, [pull("main"), pull("feature/thing")], {})).toEqual(new Set());
  });

  it("counts the keys the daemon has given up on", () => {
    const failed = { "PROJ-3": { at: "2026-10-01T07:30:00.000Z", reason: "no changes produced" } };
    expect(handledKeys(keys, [pull("feature/PROJ-1")], failed)).toEqual(new Set(["PROJ-1", "PROJ-3"]));
  });

  it("counts a key that both failed and has a pull request once", () => {
    const failed = { "PROJ-1": { at: "2026-10-01T07:30:00.000Z", reason: "push rejected" } };
    expect(handledKeys(keys, [pull("feature/PROJ-1")], failed)).toEqual(new Set(["PROJ-1"]));
  });
});

describe("buildJql", () => {
  it("asks Jira for exactly the eligible issues, in its own order", () => {
    expect(buildJql({ project: "PROJ", label: "auto-ai-implement" })).toBe(
      'project = "PROJ" AND labels = "auto-ai-implement" AND statusCategory != Done ' +
        "ORDER BY priority DESC, created ASC",
    );
  });

  it("escapes quotes and backslashes in both values", () => {
    expect(buildJql({ project: 'P"J', label: "l" })).toContain('project = "P\\"J"');
    expect(buildJql({ project: "P\\J", label: "l" })).toContain('project = "P\\\\J"');
    expect(buildJql({ project: "P", label: 'l"x' })).toContain('labels = "l\\"x"');
    expect(buildJql({ project: "P", label: "l\\x" })).toContain('labels = "l\\\\x"');
  });
});
