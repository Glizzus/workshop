import { describe, expect, it, vi } from "vitest";

import { Git } from "./git.js";
import type { Runner } from "./run.js";

function fakeRunner(stdout = ""): { run: Runner; calls: { args: readonly string[]; cwd: string | undefined }[] } {
  const calls: { args: readonly string[]; cwd: string | undefined }[] = [];
  const run: Runner = vi.fn((args, options) => {
    calls.push({ args, cwd: options?.cwd });
    return Promise.resolve({ stdout, stderr: "" });
  });
  return { run, calls };
}

describe("Git", () => {
  it("runs every command in its directory", async () => {
    const { run, calls } = fakeRunner();
    await new Git("/repo", { runner: run }).fetch("origin");
    expect(calls).toEqual([{ args: ["fetch", "origin"], cwd: "/repo" }]);
  });

  it("passes a refspec through to fetch untouched", async () => {
    const { run, calls } = fakeRunner();
    await new Git("/repo", { runner: run }).fetch("origin", "pull/7/head");
    expect(calls[0]?.args).toEqual(["fetch", "origin", "pull/7/head"]);
  });

  it("adds a detached worktree and returns a Git bound to it", async () => {
    const { run, calls } = fakeRunner();
    const wt = await new Git("/repo", { runner: run }).worktreeAdd("/wt/pr-7", "FETCH_HEAD", { detach: true });
    expect(calls[0]?.args).toEqual(["worktree", "add", "--detach", "/wt/pr-7", "FETCH_HEAD"]);
    expect(wt.dir).toBe("/wt/pr-7");

    await wt.checkout("FETCH_HEAD", { detach: true });
    expect(calls[1]).toEqual({ args: ["checkout", "--detach", "FETCH_HEAD"], cwd: "/wt/pr-7" });
  });

  it("removes a worktree, forcing only when asked", async () => {
    const { run, calls } = fakeRunner();
    const git = new Git("/repo", { runner: run });
    await git.worktreeRemove("/wt/a");
    await git.worktreeRemove("/wt/b", { force: true });
    expect(calls.map((c) => c.args)).toEqual([
      ["worktree", "remove", "/wt/a"],
      ["worktree", "remove", "--force", "/wt/b"],
    ]);
  });

  it("prepends -c entries in order to every command", async () => {
    const { run, calls } = fakeRunner();
    const git = new Git("/repo", { runner: run, config: [["credential.helper", ""], ["credential.helper", "!h"]] });
    await git.fetch("origin");
    await git.at("/wt").fetch("origin");
    expect(calls.map((c) => c.args)).toEqual([
      ["-c", "credential.helper=", "-c", "credential.helper=!h", "fetch", "origin"],
      ["-c", "credential.helper=", "-c", "credential.helper=!h", "fetch", "origin"],
    ]);
  });

  it("clones without a working directory and returns a Git for the clone", async () => {
    const { run, calls } = fakeRunner();
    const git = await Git.clone("https://x/o/r.git", "/root/repo.git", { runner: run, bare: true });
    expect(calls).toEqual([{ args: ["clone", "--bare", "https://x/o/r.git", "/root/repo.git"], cwd: undefined }]);
    expect(git.dir).toBe("/root/repo.git");
  });

  it("lists worktrees parsed from porcelain output", async () => {
    const { run } = fakeRunner(
      ["worktree /repo", "HEAD aaa", "branch refs/heads/main", "", "worktree /wt/pr-7", "HEAD bbb", "detached", ""].join("\n"),
    );
    const list = await new Git("/repo", { runner: run }).worktreeList();
    expect(list.map((w) => [w.path, w.head, w.branch, w.detached])).toEqual([
      ["/repo", "aaa", "refs/heads/main", false],
      ["/wt/pr-7", "bbb", undefined, true],
    ]);
  });
});
