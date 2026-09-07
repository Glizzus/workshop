import { describe, expect, it } from "vitest";

import { isFromFork, pullRequestHeadRef } from "./logic.js";
import type { PullRequest } from "./types.js";

function pr(head: PullRequest["head"]["repo"]): PullRequest {
  return {
    number: 1,
    title: "t",
    html_url: "https://github.com/o/r/pull/1",
    state: "open",
    draft: false,
    user: { login: "u" },
    labels: [],
    updated_at: "2026-09-06T00:00:00Z",
    head: { sha: "abc", ref: "feature", repo: head },
    base: { ref: "main", repo: { full_name: "o/r" } },
  };
}

describe("pullRequestHeadRef", () => {
  it("names GitHub's ref for a pull request head", () => {
    expect(pullRequestHeadRef(42)).toBe("pull/42/head");
  });
});

describe("isFromFork", () => {
  it("is false when the branch lives in the base repository", () => {
    expect(isFromFork(pr({ full_name: "o/r" }))).toBe(false);
  });
  it("is true for a fork, and for a deleted fork", () => {
    expect(isFromFork(pr({ full_name: "someone/r" }))).toBe(true);
    expect(isFromFork(pr(null))).toBe(true);
  });
});
