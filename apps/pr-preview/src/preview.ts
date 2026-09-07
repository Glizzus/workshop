import { spawn } from "node:child_process";
import { access, constants } from "node:fs/promises";
import path from "node:path";

import type { Git, Worktree } from "@glizzus/git";
import { pullRequestHeadRef } from "@glizzus/github";

import type { Action, ExistingPreview } from "./plan.js";
import type { State } from "./state.js";

/** Ports handed to previews. One per PR, held until the PR closes. */
export const PORT_RANGE = { from: 4000, to: 4999 } as const;

/** Where the worktree for a pull request lives: `<root>/pr-<number>`. */
export function previewDir(root: string, number: number): string {
  return path.join(root, `pr-${String(number)}`);
}

/**
 * The previews that exist, read from git's worktree list rather than from
 * state, so a worktree removed by hand is noticed and recreated. Only
 * directories directly under `root` named `pr-<number>` count.
 */
export function existingPreviews(worktrees: readonly Worktree[], root: string, state: State): ExistingPreview[] {
  const previews: ExistingPreview[] = [];
  for (const wt of worktrees) {
    if (path.dirname(wt.path) !== root) continue;
    const match = /^pr-(\d+)$/.exec(path.basename(wt.path));
    if (!match?.[1]) continue;
    const number = Number(match[1]);
    previews.push({ number, sha: state[String(number)]?.sha });
  }
  return previews;
}

/** The lowest port in {@link PORT_RANGE} that no preview holds. */
export function allocatePort(state: State): number {
  const used = new Set(Object.values(state).map((p) => p.port));
  for (let port = PORT_RANGE.from; port <= PORT_RANGE.to; port++) {
    if (!used.has(port)) return port;
  }
  throw new Error(`no free port in ${String(PORT_RANGE.from)}-${String(PORT_RANGE.to)}`);
}

/** What the hooks learn about their preview through the environment. */
export interface HookEnv {
  PR_NUMBER: string;
  PR_SHA: string;
  PORT: string;
  PR_TITLE?: string;
  PR_URL?: string;
}

/**
 * Runs `<dir>/.pr-preview/<name>` if the repository ships one, and returns
 * its exit code; `undefined` when there is no such hook. The hook is
 * executed directly, so it needs a shebang and the executable bit, like a
 * git hook.
 */
export async function runHook(name: "up" | "down", dir: string, env: HookEnv): Promise<number | null | undefined> {
  const hook = path.join(dir, ".pr-preview", name);
  try {
    await access(hook, constants.X_OK);
  } catch {
    return undefined;
  }
  return new Promise((resolve, reject) => {
    const child = spawn(hook, [], { cwd: dir, stdio: "inherit", env: { ...process.env, ...env } });
    child.on("error", reject);
    child.on("close", resolve);
  });
}

/**
 * Carries out one action against the clone. Create and update both fetch
 * the pull request's head ref, which works for forks too, then put a
 * detached worktree at the sha the API reported rather than at FETCH_HEAD:
 * FETCH_HEAD is per-worktree, and pinning the sha keeps the worktree in
 * step with what state records even if the ref moved meanwhile. Neither
 * creates a branch, so there is nothing to clean up in refs/heads.
 */
export async function apply(git: Git, root: string, action: Action): Promise<void> {
  const dir = previewDir(root, action.number);
  switch (action.kind) {
    case "create":
      await git.fetch("origin", pullRequestHeadRef(action.number));
      await git.worktreeAdd(dir, action.sha, { detach: true });
      break;
    case "update":
      await git.fetch("origin", pullRequestHeadRef(action.number));
      await git.at(dir).checkout(action.sha, { detach: true });
      break;
    case "remove":
      await git.worktreeRemove(dir, { force: true });
      break;
  }
}
