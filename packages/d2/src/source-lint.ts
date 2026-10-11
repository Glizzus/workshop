import { hasCasedKeyword, RESERVED } from "./keywords.js";

// `key: |md` (or `||`, `|||`) opens a block string that runs until a line
// holding just the same pipes. Nothing inside one is D2 syntax.
const BLOCK_OPEN_RE = /:\s*(\|{1,3})[A-Za-z0-9_+-]*\s*$/;

/**
 * Tracks block strings line by line. `skip(line)` is true for lines that open,
 * sit inside, or close a block string, which neither lint should read.
 */
function blockStrings(): (line: string) => boolean {
  let closer: string | undefined;
  return (line) => {
    if (closer !== undefined) {
      const stripped = line.trim();
      if (stripped === closer || stripped.startsWith(closer + " ")) closer = undefined;
      return true;
    }
    const m = BLOCK_OPEN_RE.exec(line);
    if (m) {
      closer = m[1];
      return true;
    }
    return false;
  };
}

/** Lines of `text` without their terminators, as Python's `str.splitlines()` gives them. */
function lines(text: string): string[] {
  const out = text.split(/\r\n|\n|\r/);
  if (out.at(-1) === "") out.pop();
  return out;
}

/** Each character outside quotes, with its index and the bracket depth after it. Escaped characters are skipped. */
function* unquoted(line: string): Generator<[ch: string, index: number, depth: number]> {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? "";
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (quote !== undefined) {
      if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
    yield [ch, i, depth];
  }
}

/**
 * Text-level traps the compiler accepts silently: capitalized keywords, and an
 * unquoted `#` or `;` inside a label. Returns one message per finding.
 */
export function sourceLint(text: string): string[] {
  const warnings: string[] = [];
  const skip = blockStrings();
  lines(text).forEach((raw, i) => {
    const n = i + 1;
    const line = raw.trimEnd();
    if (skip(line)) return;
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#")) return;

    const keyPart = line.split(":", 1)[0] ?? "";
    if (line.includes(":") && hasCasedKeyword(keyPart + ":")) {
      warnings.push(
        `line ${n}: capitalized keyword in '${keyPart.trim()}'. Keywords ` +
          `must be lowercase; as written it is ignored or errors ` +
          `(d2 fmt lowercases it).`,
      );
    }

    let colon: number | undefined;
    for (const [ch, j, depth] of unquoted(line)) {
      if (ch === ":" && depth === 0 && colon === undefined) {
        colon = j;
      } else if (ch === "#" && depth === 0 && colon !== undefined) {
        const before = line.slice(colon + 1, j).trim();
        if (before && !before.endsWith("{")) {
          warnings.push(
            `line ${n}: unquoted '#' starts a comment, so the label ` +
              `is cut to '${before}'. Quote the whole label if the # ` +
              `is meant to be text.`,
          );
        }
        break;
      } else if (ch === ";" && depth === 0 && colon !== undefined) {
        const label = line.slice(colon + 1, j).trim();
        const rest = line.slice(j + 1).trim();
        // `a: x; y` -> label "x" plus a NEW shape "y". Legit uses like
        // `a: A; b: B` (two declarations) have a colon after the ';'.
        if (label && !label.startsWith("{") && rest && !rest.includes(":")) {
          warnings.push(
            `line ${n}: unquoted ';' ends the label, so '${rest}' ` +
              `becomes a separate shape. Quote the label if the ` +
              `semicolon is text.`,
          );
        }
        break;
      }
    }
  });
  return warnings;
}

const LABEL_KEYWORD_RE = /^(\s*)([^:#{}"']+?)(\s*:\s*)([A-Za-z][\w-]*)(\s*(?:\{.*)?)$/;

/**
 * `d2 fmt` lowercases an unquoted label that spells a keyword (`base: Shape`
 * becomes `base: shape`). Quoting the label first stops that without changing
 * how it renders. Returns the new text and the 1-based numbers of the lines
 * that were quoted.
 */
export function protectKeywordLabels(text: string): { text: string; changed: number[] } {
  const out: string[] = [];
  const changed: number[] = [];
  const skip = blockStrings();
  // Keep each line's terminator so the file round-trips byte for byte.
  const withEnds = text === "" ? [] : text.split(/(?<=\n)/);
  withEnds.forEach((line, i) => {
    const body = line.endsWith("\n") ? line.slice(0, -1) : line;
    if (skip(body)) {
      out.push(line);
      return;
    }
    const m = LABEL_KEYWORD_RE.exec(body);
    if (m) {
      const [, indent = "", key = "", sep = "", val = "", tail = ""] = m;
      const keyLast = (key.trim().split(".").at(-1) ?? "").trim().toLowerCase();
      if (
        RESERVED.has(val.toLowerCase()) &&
        val !== val.toLowerCase() &&
        (!RESERVED.has(keyLast) || keyLast === "label" || keyLast === "tooltip")
      ) {
        changed.push(i + 1);
        out.push(`${indent}${key}${sep}"${val}"${tail}` + (line.endsWith("\n") ? "\n" : ""));
        return;
      }
    }
    out.push(line);
  });
  return { text: out.join(""), changed };
}
