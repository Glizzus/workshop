/**
 * Parses `git ls-remote --heads <remote>`: one line per branch, the commit id,
 * a tab, then `refs/heads/<name>`. Returns the names. Blank lines are ignored,
 * so empty output is no branches.
 */
export function parseRemoteHeads(stdout: string): string[] {
  const names: string[] = [];
  for (const line of stdout.split("\n")) {
    const ref = line.split("\t")[1];
    if (ref?.startsWith("refs/heads/")) names.push(ref.slice("refs/heads/".length));
  }
  return names;
}
