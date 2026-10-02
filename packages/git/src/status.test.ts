import { describe, expect, it } from "vitest";

import { parseStatus } from "./status.js";

describe("parseStatus", () => {
  it("parses the XY code and path of each changed entry", () => {
    expect(parseStatus([" M src/git.ts", "A  src/status.ts", "?? notes.txt", "D  gone.ts", ""].join("\n"))).toEqual([
      { code: " M", path: "src/git.ts" },
      { code: "A ", path: "src/status.ts" },
      { code: "??", path: "notes.txt" },
      { code: "D ", path: "gone.ts" },
    ]);
  });

  it("keeps a rename's `old -> new` text whole", () => {
    expect(parseStatus("R  src/old.ts -> src/new.ts\n")).toEqual([
      { code: "R ", path: "src/old.ts -> src/new.ts" },
    ]);
  });

  it("returns nothing for a clean worktree and handles a missing trailing newline", () => {
    expect(parseStatus("")).toEqual([]);
    expect(parseStatus("\n\n")).toEqual([]);
    expect(parseStatus(" M a.ts").map((e) => e.path)).toEqual(["a.ts"]);
  });
});
