// Where everything the daemon owns lives, under one root directory it is given.
// Pure path arithmetic, so the shape of the working directory can be asserted
// without creating any of it.

import path from "node:path";

/** A Jira issue key, such as `PROJ-12`. */
const KEY = /^[A-Z][A-Z0-9_]*-\d+$/;

/**
 * Guards an issue key before it becomes a path segment. Keys arrive from Jira rather than from the
 * operator, and a key like `../etc` would escape the root entirely once joined.
 */
function requireKey(key: string): string {
  if (!KEY.test(key)) throw new Error(`not a Jira issue key: ${JSON.stringify(key)}`);
  return key;
}

/** The bare clone every worktree is cut from: `<root>/repo.git`. */
export function cloneDir(root: string): string {
  return path.join(root, "repo.git");
}

/** Where an issue's worktree lives: `<root>/wt-<KEY>`. */
export function worktreeDir(root: string, key: string): string {
  return path.join(root, `wt-${requireKey(key)}`);
}

/** Where one night's attempt at an issue keeps its logs: `<root>/runs/<night>/<KEY>`. */
export function runDir(root: string, night: string, key: string): string {
  return path.join(root, "runs", night, requireKey(key));
}
