/** One entry of `git worktree list --porcelain`. */
export interface Worktree {
  /** Absolute path of the worktree. */
  path: string;
  /** Commit checked out, or undefined for a bare worktree. */
  head: string | undefined;
  /** Full ref name (`refs/heads/main`) when a branch is checked out. */
  branch: string | undefined;
  detached: boolean;
  bare: boolean;
  locked: boolean;
  prunable: boolean;
}

/**
 * Parses the porcelain worktree listing: stanzas separated by blank lines,
 * each a `worktree <path>` line followed by attribute lines. Unknown
 * attributes are ignored so newer git versions do not break the parse.
 */
export function parseWorktreeList(porcelain: string): Worktree[] {
  const worktrees: Worktree[] = [];
  let current: Worktree | undefined;

  for (const line of porcelain.split("\n")) {
    if (line === "") {
      if (current) worktrees.push(current);
      current = undefined;
      continue;
    }
    const space = line.indexOf(" ");
    const key = space === -1 ? line : line.slice(0, space);
    const value = space === -1 ? "" : line.slice(space + 1);

    if (key === "worktree") {
      current = {
        path: value,
        head: undefined,
        branch: undefined,
        detached: false,
        bare: false,
        locked: false,
        prunable: false,
      };
      continue;
    }
    if (!current) continue;
    switch (key) {
      case "HEAD":
        current.head = value;
        break;
      case "branch":
        current.branch = value;
        break;
      case "detached":
        current.detached = true;
        break;
      case "bare":
        current.bare = true;
        break;
      case "locked":
        current.locked = true;
        break;
      case "prunable":
        current.prunable = true;
        break;
    }
  }
  if (current) worktrees.push(current);
  return worktrees;
}
