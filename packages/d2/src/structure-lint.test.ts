import { describe, expect, it } from "vitest";

import { decodeIds, splitPath, structureLint } from "./structure-lint.js";

/** An SVG holding one `<g>` per ID, encoded the way d2 writes them. */
function svg(...ids: string[]): string {
  return ids.map((id) => `<g class="${Buffer.from(id).toString("base64")}"></g>`).join("\n");
}

describe("decodeIds", () => {
  it("decodes IDs and skips d2's own classes", () => {
    expect(decodeIds(svg("a", "(a -&gt; b)[0]") + '<g class="shape"></g><g class="AAE="></g>')).toEqual([
      "a",
      "(a -> b)[0]",
    ]);
  });
});

describe("splitPath", () => {
  it("splits on dots outside quotes", () => {
    expect(splitPath('net."api.example.com".x')).toEqual(["net", '"api.example.com"', "x"]);
  });
});

describe("structureLint", () => {
  it("counts objects and connections", () => {
    expect(structureLint(svg("a", "b", "(a -> b)[0]"), "")).toEqual({ warnings: [], objects: 2, connections: 1 });
  });

  it("flags a dotted name split into containers, once per chain", () => {
    const { warnings } = structureLint(svg("api", "api.example", "api.example.com"), "");
    expect(warnings).toEqual([
      `object 'api.example.com' looks like a dotted name that was split into nested containers. If it is one name (host, file, version), quote it: "api.example.com"`,
    ]);
  });

  it("flags a version number split into containers", () => {
    expect(structureLint(svg("v1", "v1.2", "v1.2.3"), "").warnings[0]).toMatch(/^object 'v1.2.3'/);
  });

  it("flags one short name at several scopes", () => {
    expect(structureLint(svg("db", "app", "app.db"), "").warnings).toEqual([
      "'db' exists at several scopes: db, app.db. Inside a container, bare names are local; to reach an outer shape use _.db (or connect from the outer scope). Ignore if the copies are intentional.",
    ]);
  });

  it("flags a connection drawn more than once", () => {
    const { warnings } = structureLint(svg("a", "b", "x", "x.(a -> b)[0]", "x.(a -> b)[1]", "(a -> b)[0]"), "");
    expect(warnings).toEqual([
      "x.(a -> b) is drawn 2 times. Writing a connection again ADDS an edge; to restyle the existing one use (a -> b)[0].style... Ignore if intentional.",
    ]);
  });

  it("allows repeats in a sequence diagram", () => {
    const ids = svg("s", "s.a", "a", "s.(a -> b)[0]", "s.(a -> b)[1]");
    expect(structureLint(ids, "s: { shape: sequence_diagram }").warnings).toEqual([]);
  });
});
