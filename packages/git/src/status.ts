/** One changed path from `git status --porcelain`. */
export interface StatusEntry {
  /**
   * The two-character `XY` code: index status, then worktree status. A space
   * means unchanged in that half, so ` M` is modified but unstaged and `M ` is
   * staged and clean, while `??` is untracked.
   */
  code: string;
  /**
   * The path exactly as git printed it, including the quoting git applies to
   * unusual characters. A rename keeps git's whole `old -> new` text rather
   * than being split, so the entry says no more and no less than git did.
   */
  path: string;
}

/**
 * Parses porcelain v1 status output: one line per path, a two-character code
 * followed by a space and the path. Blank lines are ignored, so the trailing
 * newline and empty output both come through as no entries.
 */
export function parseStatus(stdout: string): StatusEntry[] {
  const entries: StatusEntry[] = [];
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;
    entries.push({ code: line.slice(0, 2), path: line.slice(3) });
  }
  return entries;
}
