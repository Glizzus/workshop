/** A line-level change: `-` for a line only in the old text, `+` for one only in the new. */
export interface LineChange {
  op: "-" | "+";
  line: string;
}

/**
 * The lines that differ between two texts, from a longest-common-subsequence
 * diff: what a unified diff with zero context lists, without its headers.
 * Quadratic in line count, which is fine for a diagram source.
 */
export function lineChanges(before: string, after: string): LineChange[] {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  // lcs[i][j]: length of the LCS of a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const changes: LineChange[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (i < a.length && (j === b.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      changes.push({ op: "-", line: a[i++]! });
    } else {
      changes.push({ op: "+", line: b[j++]! });
    }
  }
  return changes;
}
