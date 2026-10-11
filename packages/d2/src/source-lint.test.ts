import { describe, expect, it } from "vitest";

import { protectKeywordLabels, sourceLint } from "./source-lint.js";

describe("sourceLint", () => {
  it("flags an unquoted # that cuts a label short", () => {
    const [w] = sourceLint("bug: Issue #42\n");
    expect(w).toMatch(/^line 1: unquoted '#' starts a comment, so the label is cut to 'Issue'/);
  });

  it("flags an unquoted ; that splits off a new shape", () => {
    const [w] = sourceLint("a: first; second\n");
    expect(w).toMatch(/^line 1: unquoted ';' ends the label, so 'second' becomes a separate shape/);
  });

  it("accepts two declarations on one line, quoted text, and trailing comments", () => {
    expect(sourceLint('a: A; b: B\nc: "Issue #42"\nd: {  # comment\n}\n# a: x #y\n')).toEqual([]);
  });

  it("flags a capitalized keyword in a key", () => {
    expect(sourceLint("x.Shape: circle\n")).toEqual([
      "line 1: capitalized keyword in 'x.Shape'. Keywords must be lowercase; as written it is ignored or errors (d2 fmt lowercases it).",
    ]);
  });

  it("ignores everything inside a block string", () => {
    expect(sourceLint("doc: |md\n  # Title; not: d2 #here\n  Shape: x\n|\nz: a #b\n")).toEqual([
      "line 5: unquoted '#' starts a comment, so the label is cut to 'a'. Quote the whole label if the # is meant to be text.",
    ]);
  });
});

describe("protectKeywordLabels", () => {
  it("quotes a label that spells a keyword in capitals", () => {
    expect(protectKeywordLabels("base: Shape\nx.label: Style {\n}\n")).toEqual({
      text: 'base: "Shape"\nx.label: "Style" {\n}\n',
      changed: [1, 2],
    });
  });

  it("leaves keyword values, lowercase labels and block strings alone", () => {
    const text = "x.shape: Circle\nbase: shape\nmd: |md\n  a: Shape\n|\n";
    expect(protectKeywordLabels(text)).toEqual({ text, changed: [] });
  });

  it("keeps a missing final newline missing", () => {
    expect(protectKeywordLabels("a: Fill").text).toBe('a: "Fill"');
  });
});
