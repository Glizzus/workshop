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

  it("forces a checkout and cleans, with the flags asked for", async () => {
    const { run, calls } = fakeRunner();
    const git = new Git("/wt", { runner: run });
    await git.checkout("abc", { force: true, detach: true });
    await git.clean();
    await git.clean({ directories: true, ignored: true });
    expect(calls.map((c) => c.args)).toEqual([
      ["checkout", "--force", "--detach", "abc"],
      ["clean", "-f"],
      ["clean", "-fdx"],
    ]);
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

  it("adds a worktree on a new branch and returns a Git bound to it", async () => {
    const { run, calls } = fakeRunner();
    const wt = await new Git("/repo", { runner: run }).worktreeAdd("/wt/feat", "refs/remotes/origin/main", {
      branch: "feature",
    });
    expect(calls).toEqual([
      { args: ["worktree", "add", "-b", "feature", "/wt/feat", "refs/remotes/origin/main"], cwd: "/repo" },
    ]);
    expect(wt.dir).toBe("/wt/feat");
  });

  it("refuses a worktree that both creates a branch and detaches", async () => {
    const { run, calls } = fakeRunner();
    const git = new Git("/repo", { runner: run });
    await expect(git.worktreeAdd("/wt/x", "HEAD", { branch: "feature", detach: true })).rejects.toThrow(
      /cannot both create a branch and detach/,
    );
    expect(calls).toEqual([]);
  });

  it("prunes worktrees whose directories are gone", async () => {
    const { run, calls } = fakeRunner();
    await new Git("/repo", { runner: run }).worktreePrune();
    expect(calls).toEqual([{ args: ["worktree", "prune"], cwd: "/repo" }]);
  });

  it("stages, commits, pushes, and deletes the branch with the flags asked for", async () => {
    const { run, calls } = fakeRunner();
    const git = new Git("/wt/feat", { runner: run });
    await git.add({ all: true });
    await git.commit("jira: AI-1");
    await git.push("origin", "feature");
    await git.push("origin", "feature", { setUpstream: true });
    await git.branchDelete("feature");
    await git.branchDelete("feature", { force: true });
    expect(calls.map((c) => c.args)).toEqual([
      ["add", "--all"],
      ["commit", "-m", "jira: AI-1"],
      ["push", "origin", "feature"],
      ["push", "--set-upstream", "origin", "feature"],
      ["branch", "--delete", "feature"],
      ["branch", "--delete", "--force", "feature"],
    ]);
    expect(calls.map((c) => c.cwd)).toEqual(Array.from({ length: 6 }, () => "/wt/feat"));
  });

  it("commits as the identity given in config", async () => {
    const { run, calls } = fakeRunner();
    const git = new Git("/wt/feat", {
      runner: run,
      config: [["user.name", "jira-ai"], ["user.email", "bot@example.com"]],
    });
    await git.commit("jira: AI-1");
    expect(calls[0]).toEqual({
      args: ["-c", "user.name=jira-ai", "-c", "user.email=bot@example.com", "commit", "-m", "jira: AI-1"],
      cwd: "/wt/feat",
    });
  });

  it("refuses an add that asks for anything but all", async () => {
    const { run, calls } = fakeRunner();
    await expect(new Git("/wt/feat", { runner: run }).add({})).rejects.toThrow(/only the `all` option/);
    expect(calls).toEqual([]);
  });

  it("lists the remote's branches", async () => {
    const { run, calls } = fakeRunner("abc\trefs/heads/main\ndef\trefs/heads/feature/PROJ-1\n");
    const heads = await new Git("/repo.git", { runner: run }).remoteHeads("origin");
    expect(calls).toEqual([{ args: ["ls-remote", "--heads", "origin"], cwd: "/repo.git" }]);
    expect(heads).toEqual(["main", "feature/PROJ-1"]);
  });

  it("reports the changed paths of a dirty worktree", async () => {
    const { run, calls } = fakeRunner(" M src/git.ts\n?? notes.txt\n");
    const entries = await new Git("/wt/feat", { runner: run }).status();
    expect(calls).toEqual([{ args: ["status", "--porcelain"], cwd: "/wt/feat" }]);
    expect(entries).toEqual([
      { code: " M", path: "src/git.ts" },
      { code: "??", path: "notes.txt" },
    ]);
  });

  it("counts the commits in a range", async () => {
    const { run, calls } = fakeRunner("3\n");
    const count = await new Git("/wt/feat", { runner: run }).revListCount("origin/main..HEAD");
    expect(calls).toEqual([{ args: ["rev-list", "--count", "origin/main..HEAD"], cwd: "/wt/feat" }]);
    expect(count).toBe(3);
  });

  it("refuses a commit count it cannot parse", async () => {
    const { run } = fakeRunner("not a number\n");
    await expect(new Git("/wt/feat", { runner: run }).revListCount("a..b")).rejects.toThrow(
      /printed not a number/,
    );
  });
});
