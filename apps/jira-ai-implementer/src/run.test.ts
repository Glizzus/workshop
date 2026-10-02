import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Git, GitError, type Runner } from "@glizzus/git";
import type { GitHubClient } from "@glizzus/github";
import type { Issue } from "@glizzus/jira";
import { describe, expect, it } from "vitest";

import { Config } from "./config.js";
import { runDir, worktreeDir } from "./layout.js";
import type { OpencodeInvocation, OpencodeResult } from "./opencode.js";
import { type AttemptContext, type Deps, attempt } from "./run.js";
import { State } from "./state.js";

const issue: Issue = {
  id: "1001",
  key: "PROJ-1",
  self: "https://jira.example.com/rest/api/2/issue/1001",
  fields: {
    summary: "Add a health endpoint",
    description: "Return 200 from /health.",
    labels: ["auto-ai-implement", "backend"],
    priority: { name: "High" },
    status: { name: "To Do" },
    issuetype: { name: "Task" },
    created: "2026-09-30T12:00:00.000+0000",
  },
};

const NIGHT = "2026-10-01";
/** What the operator's hook names for PROJ-1. */
const BRANCH = "feature/PROJ-1-health";

const config: Config = Config.parse({
  jira: { baseUrl: "https://jira.example.com", project: "PROJ" },
  repo: { github: "owner/name" },
  window: { timezone: "America/Chicago" },
  opencode: { model: "ollama/qwen3-coder" },
});

const ok: OpencodeResult = { code: 0, signal: null, timedOut: false, durationMs: 1 };

/** What a harness lets a test change about the world. */
interface HarnessOptions {
  /** Canned stdout per argv, given the harness's root; `undefined` falls through to the defaults. */
  stdout?: (args: readonly string[], root: string) => string | undefined;
  /** An error to reject a matching git invocation with. */
  gitError?: (args: readonly string[]) => Error | undefined;
  opencode?: () => Promise<OpencodeResult>;
  /** What `hooks/branch` says. */
  branchHook?: () => Promise<string>;
  state?: State;
}

interface Harness {
  deps: Deps;
  ctx: AttemptContext;
  gitArgs: readonly string[][];
  /** Every `createPullRequest` call, as its arguments. */
  github: unknown[][];
  logs: string[];
  root: string;
}

async function harness(options: HarnessOptions = {}): Promise<Harness> {
  const root = await mkdtemp(path.join(os.tmpdir(), "jira-ai-run-"));
  const gitArgs: string[][] = [];
  const github: unknown[][] = [];
  const logs: string[] = [];

  const runner: Runner = (args) => {
    // The `-c` entries a real daemon prepends are not what these tests are about.
    const argv = [...args];
    gitArgs.push(argv);
    const error = options.gitError?.(argv);
    if (error) return Promise.reject(error);
    const canned = options.stdout?.(argv, root);
    if (canned !== undefined) return Promise.resolve({ stdout: canned, stderr: "" });
    const joined = argv.join(" ");
    if (joined === "worktree list --porcelain") return Promise.resolve({ stdout: "", stderr: "" });
    if (joined === "status --porcelain") return Promise.resolve({ stdout: " M src/health.ts\n", stderr: "" });
    if (argv[0] === "rev-list") return Promise.resolve({ stdout: "0\n", stderr: "" });
    return Promise.resolve({ stdout: "", stderr: "" });
  };

  const deps: Deps = {
    git: new Git(path.join(root, "repo.git"), { runner }),
    github: {
      createPullRequest: (...args: unknown[]) => {
        github.push(args);
        return Promise.resolve({ number: 7, html_url: "https://github.com/owner/name/pull/7" });
      },
    } as unknown as GitHubClient,
    branchHook: options.branchHook ?? ((): Promise<string> => Promise.resolve(BRANCH)),
    opencode: options.opencode ?? ((): Promise<OpencodeResult> => Promise.resolve(ok)),
    now: () => new Date("2026-10-01T07:30:00.000Z"),
    log: (text: string) => logs.push(text),
  };

  const ctx: AttemptContext = {
    config,
    root,
    night: NIGHT,
    state: options.state ?? State.parse({}),
    instructions: ["/skill/SKILL.md"],
  };
  return { deps, ctx, gitArgs, github, logs, root };
}

function argvOf(harnessed: Harness): string[] {
  return harnessed.gitArgs.map((args) => args.join(" "));
}

describe("attempt: the happy path", () => {
  it("prepares a worktree, commits, pushes, and opens a draft pull request", async () => {
    const h = await harness();
    const invocations: OpencodeInvocation[] = [];
    h.deps.opencode = (inv) => {
      invocations.push(inv);
      return Promise.resolve(ok);
    };
    const wt = worktreeDir(h.root, "PROJ-1");
    const run = runDir(h.root, NIGHT, "PROJ-1");
    await mkdir(run, { recursive: true });
    await writeFile(path.join(run, "pr.md"), "PROJ-1: add health endpoint\n\nDone.\n");

    const result = await attempt(h.deps, h.ctx, issue);

    expect(result).toEqual({ outcome: "pr", prUrl: "https://github.com/owner/name/pull/7" });
    expect(argvOf(h)).toEqual([
      `fetch origin +refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`,
      "worktree list --porcelain",
      `branch --delete --force ${BRANCH}`,
      `worktree add -b ${BRANCH} ${wt} refs/remotes/origin/${BRANCH}`,
      "status --porcelain",
      `rev-list --count refs/remotes/origin/${BRANCH}..HEAD`,
      "add --all",
      "commit -m PROJ-1: Add a health endpoint",
      `push --set-upstream origin ${BRANCH}`,
      `worktree remove --force ${wt}`,
      `branch --delete --force ${BRANCH}`,
    ]);

    expect(invocations[0]?.worktree).toBe(wt);
    expect(invocations[0]?.instructions).toEqual(["/skill/SKILL.md"]);
    expect(invocations[0]?.prompt).toContain(`${run}/ticket.md`);
    expect(await readFile(path.join(run, "ticket.md"), "utf8")).toContain("# PROJ-1: Add a health endpoint");

    expect(h.github[0]).toEqual([
      "owner/name",
      {
        title: "PROJ-1: add health endpoint",
        head: BRANCH,
        base: "main",
        body: "Done.\n\n---\nJira: https://jira.example.com/browse/PROJ-1",
        draft: true,
      },
    ]);

    expect(h.ctx.state.lastPrNight).toBe(NIGHT);
    expect(h.ctx.state.failed).toEqual({});
    expect(JSON.parse(await readFile(path.join(h.root, "state.json"), "utf8"))).toEqual({
      lastPrNight: NIGHT,
      failed: {},
    });
  });

  it("removes a worktree left over from a crashed run before adding its own", async () => {
    const h = await harness({
      stdout: (args, root) =>
        args.join(" ") === "worktree list --porcelain"
          ? `worktree ${worktreeDir(root, "PROJ-1")}\nHEAD abc123\n\n`
          : undefined,
    });
    const wt = worktreeDir(h.root, "PROJ-1");

    await attempt(h.deps, h.ctx, issue);
    expect(argvOf(h).slice(0, 4)).toEqual([
      `fetch origin +refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`,
      "worktree list --porcelain",
      `worktree remove --force ${wt}`,
      `branch --delete --force ${BRANCH}`,
    ]);
  });

  it("skips the commit when the agent committed its own work", async () => {
    const h = await harness({
      stdout: (args) => {
        const joined = args.join(" ");
        if (joined === "status --porcelain") return "";
        if (args[0] === "rev-list") return "2\n";
        return undefined;
      },
    });

    const result = await attempt(h.deps, h.ctx, issue);
    expect(result.outcome).toBe("pr");
    expect(argvOf(h)).not.toContain("add --all");
    expect(argvOf(h)).toContain(`push --set-upstream origin ${BRANCH}`);
  });

  it("forgets an earlier failure once the issue has its pull request", async () => {
    const state = State.parse({
      failed: { "PROJ-1": { at: "2026-09-30T07:10:00.000Z", reason: "no changes produced" } },
    });
    const h = await harness({ state });

    await attempt(h.deps, h.ctx, issue);
    expect(h.ctx.state.failed).toEqual({});
  });
});

interface FailureCase {
  name: string;
  options: HarnessOptions;
  reason: RegExp;
}

const failures: FailureCase[] = [
  {
    name: "opencode exits non-zero",
    options: { opencode: () => Promise.resolve({ ...ok, code: 1 }) },
    reason: /^opencode exited 1 \(see .*opencode\.stderr\.log\)$/,
  },
  {
    name: "opencode is killed on a timeout",
    options: {
      opencode: () => Promise.resolve({ code: null, signal: "SIGKILL", timedOut: true, durationMs: 1 }),
    },
    reason: /^opencode timed out after 90 minutes$/,
  },
  {
    name: "the agent produced nothing",
    options: {
      stdout: (args) =>
        args.join(" ") === "status --porcelain" ? "" : args[0] === "rev-list" ? "0\n" : undefined,
    },
    reason: /^no changes produced$/,
  },
  {
    name: "the push is rejected",
    options: {
      gitError: (args) =>
        args[0] === "push" ? new GitError(args, 1, "rejected: non-fast-forward") : undefined,
    },
    reason: /^git push .* exited 1: rejected: non-fast-forward$/,
  },
];

describe("attempt: failures", () => {
  it.each(failures)("records the failure and tidies up when $name", async ({ options, reason }) => {
    const h = await harness(options);
    const wt = worktreeDir(h.root, "PROJ-1");

    const result = await attempt(h.deps, h.ctx, issue);

    expect(result.outcome).toBe("failed");
    expect(result.outcome === "failed" && result.reason).toMatch(reason);
    expect(h.github).toEqual([]);

    expect(h.ctx.state.failed["PROJ-1"]).toEqual({
      at: "2026-10-01T07:30:00.000Z",
      reason: expect.stringMatching(reason) as unknown as string,
    });
    expect(h.ctx.state.lastPrNight).toBeUndefined();
    expect(argvOf(h)).toContain(`worktree remove --force ${wt}`);
    const written = JSON.parse(await readFile(path.join(h.root, "state.json"), "utf8")) as State;
    expect(written.failed).toHaveProperty("PROJ-1");
  });

  it("fails the attempt when the branch hook does, before touching git", async () => {
    const h = await harness({ branchHook: () => Promise.reject(new Error("branch hook exited 1")) });
    const wt = worktreeDir(h.root, "PROJ-1");

    const result = await attempt(h.deps, h.ctx, issue);

    expect(result).toEqual({ outcome: "failed", reason: "branch hook exited 1" });
    expect(argvOf(h)).toEqual([`worktree remove --force ${wt}`]);
    expect(h.ctx.state.failed).toHaveProperty("PROJ-1");
  });

  it("fails the attempt rather than throwing when git cannot even fetch", async () => {
    const h = await harness({
      gitError: (args) =>
        args[0] === "fetch" ? new GitError(args, 128, "could not read from remote") : undefined,
    });

    const result = await attempt(h.deps, h.ctx, issue);
    expect(result).toEqual({
      outcome: "failed",
      reason: expect.stringContaining("could not read from remote") as unknown as string,
    });
  });
});
