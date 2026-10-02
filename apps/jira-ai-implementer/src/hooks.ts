// The operator's chance to have a branch made before an attempt. If
// `<root>/hooks/create-branch` exists and is executable, it is run when no
// branch on origin carries the issue key yet. It asks whatever tooling makes
// branches to make one; it prints nothing the daemon reads. The daemon then
// watches origin for the branch to appear.

import { spawn } from "node:child_process";
import { access, constants } from "node:fs/promises";
import path from "node:path";

/** What the hook is told, as environment variables. */
export interface CreateBranchEnv {
  ISSUE_KEY: string;
  /** `owner/name`. */
  REPO: string;
  BASE_BRANCH: string;
}

/** `<root>/hooks/create-branch`. */
export function createBranchHookPath(root: string): string {
  return path.join(root, "hooks", "create-branch");
}

/**
 * Runs the hook if there is one. Returns whether it ran; a non-zero exit is an error. Its output
 * goes to the daemon's own stderr, since there is nothing in it for the daemon to parse.
 */
export async function runCreateBranchHook(root: string, env: CreateBranchEnv): Promise<boolean> {
  const hook = createBranchHookPath(root);
  try {
    await access(hook, constants.X_OK);
  } catch {
    return false;
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(hook, [], { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, ...env } });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`create-branch hook exited ${String(code)}`));
    });
  });
  return true;
}
