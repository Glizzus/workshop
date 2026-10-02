// Which issue to work on next. Jira does the filtering and the ordering -- its
// own priority and age -- so this only has to drop what has already been dealt
// with and take the first of the rest.

/**
 * The search the daemon runs. The label and the project are both expressible in JQL, so Jira
 * returns exactly the eligible issues in the order they should be worked on, and the first row is
 * the issue to work on. `statusCategory != Done` is there because a closed ticket with the label
 * still on it is not work.
 */
export function buildJql(jira: { project: string; label: string }): string {
  const project = escape(jira.project);
  const label = escape(jira.label);
  return (
    `project = "${project}" AND labels = "${label}" AND statusCategory != Done ` +
    `ORDER BY priority DESC, created ASC`
  );
}

/** Quotes a value for a JQL string literal. */
function escape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * The first key in Jira's order that is not to be skipped. `undefined` when nothing is left, which
 * is what tells the loop to wait and poll again.
 */
export function selectNext(keys: readonly string[], skip: ReadonlySet<string>): string | undefined {
  return keys.find((key) => !skip.has(key));
}

/**
 * Of `keys`, the issues already dealt with: one that has a pull request, open or closed, whose head
 * branch names it, and one the daemon has given up on. The pull requests are the record, which is
 * why the daemon writes nothing back to Jira -- a merged, closed, or still-open branch all mean the
 * same thing, that this ticket has had its go. Whoever makes the branch, the daemon or an
 * operator's hook, puts the key in its name.
 */
export function handledKeys(
  keys: readonly string[],
  pullRequests: readonly { head: { ref: string } }[],
  failed: Record<string, unknown>,
): Set<string> {
  const handled = new Set(Object.keys(failed));
  const refs = pullRequests.map((pullRequest) => pullRequest.head.ref);
  for (const key of keys) {
    if (refs.some((ref) => mentions(ref, key))) handled.add(key);
  }
  return handled;
}

/**
 * Whether a branch name contains `key` as a whole: `PROJ-1` is in `feature/PROJ-1-health`,
 * `feature/PROJ-1` and `proj-1_fix`, and is not in `PROJ-12` or `XPROJ-1`. A key ends in digits and a
 * project key may hold letters, digits and underscores, so those are the characters that would
 * make it part of a longer key. Case-insensitive, since a hook may lowercase.
 */
function mentions(ref: string, key: string): boolean {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_])${escaped}(?![0-9])`, "i").test(ref);
}
