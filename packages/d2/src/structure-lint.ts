import { RESERVED, SUSPICIOUS_SEGMENTS } from "./keywords.js";

const G_CLASS_RE = /<g class="([A-Za-z0-9+/=]+)"/g;
const EDGE_RE = /^(?:(?<scope>.*)\.)?\((?<src>.+?) (?<op><->|->|<-|--) (?<dst>.+?)\)\[(?<idx>\d+)\]$/;
// Python's str.isprintable(): no control, format, private-use or unassigned
// characters, and no separators other than the ASCII space.
const PRINTABLE_RE = /^(?:[^\p{C}\p{Z}]| )*$/u;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Reverses the escaping D2 applies to IDs (Go's html.EscapeString, plus numeric references). */
function unescapeHtml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

const utf8 = new TextDecoder("utf-8", { fatal: true });

/**
 * The object and connection IDs of a rendered (unbundled) SVG. D2 writes each
 * one, base64-encoded, as the class of its `<g>`; classes that do not decode
 * cleanly to printable text are D2's own and are skipped.
 */
export function decodeIds(svg: string): string[] {
  const ids: string[] = [];
  for (const [, cls = ""] of svg.matchAll(G_CLASS_RE)) {
    const raw = Buffer.from(cls, "base64");
    // Node decodes leniently; a round trip is the strict check.
    if (raw.toString("base64") !== cls) continue;
    let s: string;
    try {
      s = utf8.decode(raw);
    } catch {
      continue;
    }
    if (!PRINTABLE_RE.test(s)) continue;
    ids.push(unescapeHtml(s));
  }
  return ids;
}

/** Splits an object path on the dots that are not inside quotes. */
export function splitPath(path: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let quote: string | undefined;
  for (const ch of path) {
    if (quote !== undefined) {
      cur += ch;
      if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === ".") {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const isDigits = (s: string): boolean => /^\d+$/.test(s);

/** What {@link structureLint} found in one board. */
export interface StructureReport {
  warnings: string[];
  objects: number;
  connections: number;
}

/**
 * Lints the compiled structure of one board, read from its unbundled SVG:
 * dotted names split into nested containers, one short name at several scopes,
 * and connections drawn more than once. `source` is the D2 text, used only to
 * spot sequence diagrams, where the last two are normal.
 */
export function structureLint(svg: string, source: string): StructureReport {
  const objects: string[] = [];
  const edges: { scope: string; src: string; op: string; dst: string; idx: number }[] = [];
  for (const id of decodeIds(svg)) {
    const g = EDGE_RE.exec(id)?.groups;
    if (g) edges.push({ scope: g["scope"] ?? "", src: g["src"] ?? "", op: g["op"] ?? "", dst: g["dst"] ?? "", idx: Number(g["idx"]) });
    else objects.push(id);
  }
  const warnings: string[] = [];
  const sequence = source.includes("sequence_diagram");

  // 1. Accidental nesting from unquoted dotted names. One hit is enough; the
  //    deeper objects of the same chain would repeat it.
  for (const obj of objects) {
    const segs = splitPath(obj);
    const suspicious = segs.slice(1).some((s) => SUSPICIOUS_SEGMENTS.has(s.toLowerCase()));
    const numeric = segs.length > 1 && segs.slice(-2).every(isDigits);
    if (suspicious || numeric) {
      warnings.push(
        `object '${obj}' looks like a dotted name that was split into ` +
          `nested containers. If it is one name (host, file, version), ` +
          `quote it: "${segs.join(".")}"`,
      );
      break;
    }
  }

  // 2. The same short name at several scopes, usually a forgotten _.name.
  if (!sequence) {
    const byLeaf = new Map<string, string[]>();
    for (const obj of objects) {
      const leaf = splitPath(obj).at(-1) ?? "";
      if (RESERVED.has(leaf)) continue;
      const key = leaf.toLowerCase();
      byLeaf.set(key, [...(byLeaf.get(key) ?? []), obj]);
    }
    for (const [leaf, paths] of [...byLeaf].sort(([a], [b]) => compare(a, b))) {
      if (paths.length > 1) {
        warnings.push(
          `'${leaf}' exists at several scopes: ${paths.join(", ")}. ` +
            `Inside a container, bare names are local; to reach an ` +
            `outer shape use _.${leaf} (or connect from the outer ` +
            `scope). Ignore if the copies are intentional.`,
        );
      }
    }
  }

  // 3. Repeated connections: D2 numbers each copy of an edge with [i].
  if (!sequence) {
    const highest = new Map<string, { scope: string; src: string; op: string; dst: string; idx: number }>();
    for (const e of edges) {
      const key = JSON.stringify([e.scope, e.src, e.op, e.dst]);
      const seen = highest.get(key);
      if (!seen || e.idx > seen.idx) highest.set(key, e);
    }
    const sorted = [...highest].sort(([a], [b]) => compare(a, b)).map(([, e]) => e);
    for (const { scope, src, op, dst, idx } of sorted) {
      if (idx < 1) continue;
      const where = scope ? `${scope}.` : "";
      warnings.push(
        `${where}(${src} ${op} ${dst}) is drawn ${idx + 1} times. Writing a ` +
          `connection again ADDS an edge; to restyle the existing one ` +
          `use (${src} ${op} ${dst})[0].style... Ignore if intentional.`,
      );
    }
  }

  return { warnings, objects: objects.length, connections: edges.length };
}
