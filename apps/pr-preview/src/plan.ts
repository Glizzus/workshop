/** What is open on GitHub: number and head commit. */
export interface OpenPullRequest {
  number: number;
  sha: string;
}

/** What exists on disk: a worktree per number, and the sha it was last put at, if known. */
export interface ExistingPreview {
  number: number;
  sha: string | undefined;
}

export type Action =
  | { kind: "create"; number: number; sha: string }
  | { kind: "update"; number: number; sha: string }
  | { kind: "remove"; number: number };

/**
 * Diffs GitHub against disk. Open without a worktree: create. Open at a
 * different or unknown sha: update. On disk but no longer open: remove.
 * Pure, so the daemon's decisions can be tested without git or GitHub.
 */
export function plan(open: readonly OpenPullRequest[], existing: readonly ExistingPreview[]): Action[] {
  const onDisk = new Map(existing.map((e) => [e.number, e.sha]));
  const actions: Action[] = [];

  for (const pr of open) {
    if (!onDisk.has(pr.number)) {
      actions.push({ kind: "create", number: pr.number, sha: pr.sha });
    } else if (onDisk.get(pr.number) !== pr.sha) {
      actions.push({ kind: "update", number: pr.number, sha: pr.sha });
    }
  }

  const stillOpen = new Set(open.map((pr) => pr.number));
  for (const e of existing) {
    if (!stillOpen.has(e.number)) actions.push({ kind: "remove", number: e.number });
  }

  return actions;
}
