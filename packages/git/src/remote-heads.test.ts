import { describe, expect, it } from "vitest";

import { parseRemoteHeads } from "./remote-heads.js";

describe("parseRemoteHeads", () => {
  it("returns the branch names, in git's order", () => {
    const stdout =
      "0123abc\trefs/heads/main\n" +
      "4567def\trefs/heads/feature/PROJ-1-health\n" +
      "89abcde\trefs/heads/release/2.0\n";
    expect(parseRemoteHeads(stdout)).toEqual(["main", "feature/PROJ-1-health", "release/2.0"]);
  });

  it("returns nothing for empty output", () => {
    expect(parseRemoteHeads("")).toEqual([]);
    expect(parseRemoteHeads("\n")).toEqual([]);
  });
});
