#!/usr/bin/env node
// Formats, compiles, renders and lints a D2 file in one step.
//
//   d2check diagram.d2 [--out DIR] [--layout dagre|elk|tala]
//                      [--no-fmt] [--png-only] [-- extra d2 flags...]
//
// In order:
//   1. Source lint     text-level traps the compiler accepts silently
//                      (unquoted '#' or ';' inside labels, capitalized keywords).
//   2. d2 fmt          normalizes the file in place. Also lowercases reserved
//                      keywords: `Shape: circle` is silently IGNORED by the
//                      compiler, `shape: circle` works. Reports what changed.
//   3. Structure lint  reads the compiled object tree out of an SVG and flags
//                      accidental nesting, scope duplicates and repeated edges.
//   4. Render          PNG (to look at) and TXT/ASCII (to read the structure).
//
// Exit codes: 0 = rendered with no warnings, 1 = compile error,
//             2 = rendered but there are warnings worth reading.
// Always open the PNG afterwards. A clean exit only means nothing obviously
// wrong was detected; it does not mean the diagram says what you intended.

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  D2,
  D2NotFoundError,
  hasCasedKeyword,
  lineChanges,
  pngSize,
  protectKeywordLabels,
  type RenderOptions,
  type RunResult,
  sourceLint,
  structureLint,
} from "@glizzus/d2";

const INSTALL_HELP =
  "d2 not found. Install it, then re-run:\n" +
  "  macOS:  brew install d2\n" +
  "  Linux:  download d2-<ver>-linux-amd64.tar.gz from " +
  "https://github.com/terrastruct/d2/releases and put bin/d2 on PATH\n" +
  "  any:    curl -fsSL https://d2lang.com/install.sh | sh -s --\n" +
  "Or set D2_BIN=/path/to/d2.";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    layout: { type: "string" },
    "no-fmt": { type: "boolean", default: false },
    "png-only": { type: "boolean", default: false },
  },
});
const [file, ...extra] = positionals;
if (file === undefined) {
  process.stderr.write("usage: d2check diagram.d2 [--out DIR] [--layout dagre|elk|tala] [--no-fmt] [--png-only] [-- d2 flags...]\n");
  process.exit(1);
}

const d2 = new D2();
const render: RenderOptions = { flags: extra, ...(opts.layout !== undefined && { layout: opts.layout }) };
const fmt = !opts["no-fmt"];

const src = resolve(file);
if (!existsSync(src) || !statSync(src).isFile()) {
  process.stderr.write(`no such file: ${src}\n`);
  process.exit(1);
}
const stem = basename(src, extname(src));
const out = resolve(opts.out ?? dirname(src));
mkdirSync(out, { recursive: true });

const log = (s = ""): void => void process.stdout.write(s + "\n");
const message = (r: RunResult): string => (r.stderr.trim() || r.stdout.trim());

try {
  process.exitCode = await check();
} catch (err) {
  if (!(err instanceof D2NotFoundError)) throw err;
  process.stderr.write(INSTALL_HELP + "\n");
  process.exitCode = 1;
}

async function check(): Promise<number> {
  log(`d2 ${await d2.version()}`);
  const warnings: string[] = [];

  let before = readFileSync(src, "utf8");
  if (fmt) {
    const protectedText = protectKeywordLabels(before);
    if (protectedText.changed.length > 0) {
      writeFileSync(src, protectedText.text);
      before = protectedText.text;
      log(
        `quoted keyword-like labels on line(s) ${protectedText.changed.join(", ")} ` +
          "(e.g. `x: Shape` -> `x: \"Shape\"`) so d2 fmt cannot lowercase them",
      );
    }
  }
  const sourceWarnings = sourceLint(before);
  warnings.push(...sourceWarnings);

  // d2 fmt "fixes" the text-level traps in a way that hides them (it turns
  // `Issue #42` into `Issue # 42` and splits `a: x; y` onto two lines), so
  // when those are present, format a temp copy and leave the file untouched
  // until they are fixed by hand.
  let formatted = src;
  let scratch: string | undefined;
  if (fmt && sourceWarnings.length > 0) {
    scratch = mkdtempSync(join(tmpdir(), "d2check-src-"));
    formatted = join(scratch, basename(src));
    copyFileSync(src, formatted);
    log("fmt: NOT applied to your file (fix the source warnings below first, then re-run); a formatted copy was compiled instead");
  }
  try {
    if (fmt) {
      const r = await d2.fmt(formatted);
      if (r.code !== 0) {
        log("COMPILE ERROR (from d2 fmt — this is a parse error):");
        log(message(r));
        return 1;
      }
      if (formatted === src) reportFmt(before, readFileSync(src, "utf8"));
    }
    const text = readFileSync(formatted, "utf8");
    if (formatted === src) return await renderAll(src, text, warnings);

    // Relative imports and local icons resolve against the file's own folder,
    // so a formatted temp copy is compiled from the original's directory.
    const beside = join(dirname(src), ".d2check-" + basename(src));
    copyFileSync(formatted, beside);
    try {
      return await renderAll(beside, text, warnings);
    } finally {
      rmSync(beside, { force: true });
    }
  } finally {
    if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
  }
}

function reportFmt(before: string, after: string): void {
  if (after === before) return;
  const changes = lineChanges(before, after);
  const loweredKeywords = changes.filter((c) => c.op === "-" && hasCasedKeyword(c.line));
  log(`fmt: reformatted ${src} (${changes.length} changed lines)`);
  if (loweredKeywords.length > 0) {
    log("fmt: lowercased reserved keywords — before fmt these were silently ignored or errors:");
    for (const c of loweredKeywords.slice(0, 8)) log(`    -${c.line}`);
  }
}

/** Every file under `dir` with extension `ext`, recursively, sorted. */
function filesUnder(dir: string, ext: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f))
    .sort();
}

async function renderAll(input: string, text: string, warnings: string[]): Promise<number> {
  // 1) Unbundled SVG (remote icons need no network) -> structural lint only.
  const summaries: string[] = [];
  const tmp = mkdtempSync(join(tmpdir(), "d2check-"));
  try {
    const svgPath = join(tmp, stem + ".svg");
    const r = await d2.render(input, svgPath, { ...render, bundle: false });
    if (r.code !== 0) {
      log("COMPILE ERROR:");
      log(message(r));
      return 1;
    }
    // A file with layers, scenarios or steps renders to a folder of boards.
    const svgs = existsSync(svgPath) ? [svgPath] : filesUnder(join(tmp, stem), ".svg");
    for (const p of svgs) {
      const report = structureLint(readFileSync(p, "utf8"), text);
      const board = relative(tmp, p);
      warnings.push(...report.warnings.map((w) => (svgs.length > 1 ? `[${board}] ${w}` : w)));
      summaries.push(`${board}: ${report.objects} objects, ${report.connections} connections`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // 2) ASCII render of the root board, to its own name. (Multi-board TXT
  //    output fails in d2 and deletes the shared output folder, so this runs
  //    root-only and before the PNG.) A working aid, not a deliverable: keep
  //    it out of the user's folder.
  let txtPath: string | undefined;
  if (!opts["png-only"]) {
    txtPath = join(tmpdir(), `d2check-${stem}.ascii.txt`);
    if ((await d2.render(input, txtPath, { ...render, target: "" })).code !== 0) txtPath = undefined;
  }

  // 3) PNG(s) to look at. Multi-board files produce a folder of PNGs.
  const pngPath = join(out, stem + ".png");
  const r = await d2.render(input, pngPath, render);
  let pngNote = "";
  if (r.code !== 0) {
    const msg = message(r);
    if (msg.includes("remote images") || msg.includes("failed to bundle")) {
      pngNote =
        "PNG written WITHOUT remote icons (no network access to fetch them). " +
        "The diagram is valid; icons appear when rendered with network access.";
    } else {
      log("RENDER ERROR (PNG):");
      log(msg);
      return 1;
    }
  }

  log("compiled OK — " + summaries.join("; "));
  const pngs = existsSync(pngPath) ? [pngPath] : filesUnder(join(out, stem), ".png");
  const sequence = text.includes("sequence_diagram");
  for (const p of pngs) {
    const size = pngSize(readFileSync(p).subarray(0, 24));
    log(`PNG:  ${p}` + (size ? `  (${size.width}x${size.height})` : ""));
    if (!size) continue;
    const { width: w, height: h } = size;
    const ratio = Math.max(w / h, h / w);
    // Small diagrams (a few boxes in a row) are fine at any ratio; text only
    // shrinks badly when the image is both lopsided and large.
    if (ratio > 3 && Math.max(w, h) > 3000 && !(h > w && sequence)) {
      warnings.push(
        `${basename(p)} is ${w}x${h} (${ratio.toFixed(1)}:1, very ${w > h ? "wide" : "tall"}). ` +
          "Fitted to a page or wiki column, its text becomes tiny. Try " +
          `${w > h ? "direction: down" : "direction: right"}, --layout=tala, a grid, or splitting the diagram, ` +
          "and compare the PNGs.",
      );
    }
  }
  if (txtPath !== undefined && existsSync(txtPath)) log(`TXT:  ${txtPath}  (ASCII render of the root board)`);
  if (pngNote) {
    log("note: " + pngNote);
  } else if (/\bicon\s*:\s*https?:\/\//.test(text)) {
    log(
      "note: remote icons are fetched at render time. If this machine has no network access the PNG shows " +
        "a grey placeholder instead of the icon, and a default (bundled) SVG export fails. That is an " +
        "environment limit, not a diagram bug; export with --bundle=false to keep icon URLs as links.",
    );
  }

  if (warnings.length > 0) {
    log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) log(" - " + w);
    log("\nNext: fix what is real, re-run, then open the PNG and check it says what you meant.");
    return 2;
  }
  log("\nNo warnings. Next: open the PNG and check it says what you meant.");
  return 0;
}
