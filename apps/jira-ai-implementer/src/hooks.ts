// Where branches come from. `<root>/hooks/branch` is the operator's: it is run
// before the worktree is made and must print the name of a branch that already
// exists on origin, made however the operator's own tooling makes branches.
// That branch is then checked out, worked on, and pushed back. The daemon
// never names a branch itself.

import { spawn } from "node:child_process";
import path from "node:path";

/** What the branch hook is told, as environment variables. */
export interface BranchHookEnv {
  ISSUE_KEY: string;
  /** `owner/name`. */
  REPO: string;
  BASE_BRANCH: string;
}

/**
 * What a printed branch name may look like: git's rules, reduced to the characters anyone names a
 * branch with. The hook's output becomes a refspec and a `-b` argument, so a stray shell prompt or
 * an error message dressed as a name has to be caught here rather than by git.
 */
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** `<root>/hooks/branch`. */
export function branchHookPath(root: string): string {
  return path.join(root, "hooks", "branch");
}

/**
 * Runs the branch hook and returns the branch it named. The name must contain the issue key: a
 * pull request's head branch is how the daemon later tells that an issue has been dealt with, so a
 * name that leaves the key out would make the issue eligible again every night. The hook's stderr
 * goes to the daemon's own. A missing hook is a startup error, checked in `main.ts`.
 */
export async function branchFromHook(root: string, env: BranchHookEnv): Promise<string> {
  const hook = branchHookPath(root);
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(hook, [], { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, ...env } });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`branch hook exited ${String(code)}`));
    });
  });

  const branch = output.trim();
  if (!BRANCH.test(branch) || branch.includes("..")) {
    throw new Error(`branch hook printed ${JSON.stringify(branch)}, which is not a branch name`);
  }
  if (!branch.includes(env.ISSUE_KEY)) {
    throw new Error(`branch hook printed ${JSON.stringify(branch)}, which does not contain ${env.ISSUE_KEY}`);
  }
  return branch;
}
