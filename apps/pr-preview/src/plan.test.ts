import { describe, expect, it } from "vitest";

import { plan } from "./plan.js";

describe("plan", () => {
  it("creates for open PRs without a worktree", () => {
    expect(plan([{ number: 1, sha: "a" }], [])).toEqual([{ kind: "create", number: 1, sha: "a" }]);
  });

  it("updates when the head moved or the recorded sha is unknown", () => {
    expect(
      plan(
        [
          { number: 1, sha: "a2" },
          { number: 2, sha: "b" },
        ],
        [
          { number: 1, sha: "a1" },
          { number: 2, sha: undefined },
        ],
      ),
    ).toEqual([
      { kind: "update", number: 1, sha: "a2" },
      { kind: "update", number: 2, sha: "b" },
    ]);
  });

  it("does nothing for a worktree already at the head", () => {
    expect(plan([{ number: 1, sha: "a" }], [{ number: 1, sha: "a" }])).toEqual([]);
  });

  it("removes worktrees whose PR is no longer open", () => {
    expect(plan([], [{ number: 3, sha: "c" }])).toEqual([{ kind: "remove", number: 3 }]);
  });
});
