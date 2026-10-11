import { describe, expect, it } from "vitest";

import { D2 } from "./d2.js";
import { lineChanges } from "./diff.js";
import { hasCasedKeyword } from "./keywords.js";
import { pngSize } from "./png.js";
import type { Runner } from "./run.js";

describe("hasCasedKeyword", () => {
  it("matches keywords in key position only", () => {
    expect(hasCasedKeyword("x.Style.Fill: red")).toBe(true);
    expect(hasCasedKeyword("x.style.fill: red")).toBe(false);
    expect(hasCasedKeyword("Shapes: x")).toBe(false);
  });
});

describe("pngSize", () => {
  it("reads width and height from the header", () => {
    const head = new Uint8Array(24);
    head.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(head.buffer).setUint32(16, 1200);
    new DataView(head.buffer).setUint32(20, 300);
    expect(pngSize(head)).toEqual({ width: 1200, height: 300 });
    expect(pngSize(new Uint8Array(24))).toBeUndefined();
  });
});

describe("lineChanges", () => {
  it("lists removed and added lines only", () => {
    expect(lineChanges("a\nB\nc", "a\nb\nc\nd")).toEqual([
      { op: "-", line: "B" },
      { op: "+", line: "b" },
      { op: "+", line: "d" },
    ]);
    expect(lineChanges("same", "same")).toEqual([]);
  });
});

describe("D2", () => {
  it("builds render arguments with flags first and paths last", async () => {
    const calls: (readonly string[])[] = [];
    const runner: Runner = (args) => {
      calls.push(args);
      return Promise.resolve({ code: 0, stdout: "v0.9.0\n", stderr: "" });
    };
    const d2 = new D2({ runner });
    expect(await d2.version()).toBe("v0.9.0");
    await d2.fmt("a.d2");
    await d2.render("a.d2", "a.svg", { flags: ["--sketch"], layout: "elk", bundle: false, target: "" });
    expect(calls).toEqual([
      ["--version"],
      ["fmt", "a.d2"],
      ["--sketch", "--layout=elk", "--bundle=false", "--target=", "a.d2", "a.svg"],
    ]);
  });
});
