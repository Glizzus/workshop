/** D2's reserved keywords. Case-sensitive: `Shape: circle` is not `shape`. */
export const RESERVED: ReadonlySet<string> = new Set([
  "label", "shape", "icon", "constraint", "tooltip", "link", "near", "width",
  "height", "direction", "top", "left", "grid-rows", "grid-columns",
  "grid-gap", "vertical-gap", "horizontal-gap", "class", "classes", "vars",
  "style", "source-arrowhead", "target-arrowhead", "layers", "scenarios",
  "steps", "opacity", "stroke", "fill", "fill-pattern", "stroke-width",
  "stroke-dash", "border-radius", "font", "font-size", "font-color", "bold",
  "italic", "underline", "text-transform", "shadow", "multiple",
  "double-border", "3d", "animated", "filled",
]);

/**
 * Path segments that almost always mean an unquoted dotted name was split into
 * nested containers (api.example.com, config.yaml, v1.2.3 ...). Kept to
 * segments that are almost never deliberate shape names; words like "app",
 * "svc" or "cloud" are common legitimate IDs and are left out.
 */
export const SUSPICIOUS_SEGMENTS: ReadonlySet<string> = new Set([
  "com", "org", "net", "io", "gov", "edu",
  "js", "ts", "jsx", "tsx", "py", "rb", "rs", "json", "yaml", "yml", "toml",
  "md", "txt", "html", "csv", "sh", "exe", "zip", "gz", "png", "svg",
  "pdf", "log", "conf", "lock",
]);

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Longest first, so `fill-pattern` wins over `fill`.
const KEYWORD_RE = new RegExp(
  "(?<![\\w-])(" +
    [...RESERVED].sort((a, b) => b.length - a.length).map(escape).join("|") +
    ")(?=\\s*[:.{])",
  "gi",
);

/** True when `text` uses a reserved keyword in a key position with any capital letter. */
export function hasCasedKeyword(text: string): boolean {
  for (const m of text.matchAll(KEYWORD_RE)) {
    const kw = m[1] ?? "";
    if (kw !== kw.toLowerCase()) return true;
  }
  return false;
}
