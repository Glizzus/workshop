import { describe, expect, it, vi } from "vitest";

import { Git, type Runner, type Worktree } from "@glizzus/git";

import { PORT_RANGE, allocatePort, apply, existingPreviews, previewDir } from "./preview.js";

function worktree(p: string): Worktree {
  return { path: p, head: "x", branch: undefined, detached: true, bare: false, locked: false, prunable: false };
}

describe("existingPreviews", () => {
  it("keeps only pr-<n> directories directly under root, with the recorded sha", () => {
    const out = existingPreviews(
      [worktree("/repo"), worktree("/root/pr-4"), worktree("/root/pr-9"), worktree("/root/other"), worktree("/elsewhere/pr-1")],
      "/root",
      { "4": { sha: "abc", port: 4000 } },
    );
    expect(out).toEqual([
      { number: 4, sha: "abc" },
      { number: 9, sha: undefined },
    ]);
  });
});

describe("allocatePort", () => {
  it("hands out the lowest port nobody holds", () => {
    expect(allocatePort({})).toBe(PORT_RANGE.from);
    expect(allocatePort({ "1": { sha: "a", port: 4000 }, "3": { sha: "c", port: 4002 } })).toBe(4001);
  });
});

describe("apply", () => {
  function fakeGit(): { git: Git; calls: { args: readonly string[]; cwd: string | undefined }[] } {
    const calls: { args: readonly string[]; cwd: string | undefined }[] = [];
    const run: Runner = vi.fn((args, options) => {
      calls.push({ args, cwd: options?.cwd });
      return Promise.resolve({ stdout: "", stderr: "" });
    });
    return { git: new Git("/repo", run), calls };
  }

  it("creates by fetching the PR head and adding a detached worktree", async () => {
    const { git, calls } = fakeGit();
    await apply(git, "/root", { kind: "create", number: 7, sha: "s" });
    expect(calls).toEqual([
      { args: ["fetch", "origin", "pull/7/head"], cwd: "/repo" },
      { args: ["worktree", "add", "--detach", previewDir("/root", 7), "FETCH_HEAD"], cwd: "/repo" },
    ]);
  });

  it("updates by fetching and checking out inside the worktree", async () => {
    const { git, calls } = fakeGit();
    await apply(git, "/root", { kind: "update", number: 7, sha: "s" });
    expect(calls).toEqual([
      { args: ["fetch", "origin", "pull/7/head"], cwd: "/repo" },
      { args: ["checkout", "--detach", "FETCH_HEAD"], cwd: "/root/pr-7" },
    ]);
  });

  it("removes with force", async () => {
    const { git, calls } = fakeGit();
    await apply(git, "/root", { kind: "remove", number: 7 });
    expect(calls[0]?.args).toEqual(["worktree", "remove", "--force", "/root/pr-7"]);
  });
});
