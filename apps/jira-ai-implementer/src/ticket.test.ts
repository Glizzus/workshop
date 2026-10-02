import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Issue } from "@glizzus/jira";
import { describe, expect, it } from "vitest";

import { parsePr, prompt, readPr, writeTicket } from "./ticket.js";

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "jira-ai-ticket-"));
}

const issue: Issue = {
  id: "1001",
  key: "PROJ-1",
  self: "https://jira.example.com/rest/api/2/issue/1001",
  fields: {
    summary: "Add a health endpoint",
    description: "Return 200 from /health.",
    labels: ["auto-ai-implement"],
    priority: { name: "High" },
    status: { name: "To Do" },
    issuetype: { name: "Task" },
    created: "2026-09-30T12:00:00.000+0000",
  },
};

const fallback = {
  key: "PROJ-1",
  summary: "Add a health endpoint",
  issueUrl: "https://jira.example.com/browse/PROJ-1",
};

describe("writeTicket", () => {
  it("writes a run header above the rendered issue", async () => {
    const dir = path.join(await tempDir(), "runs", "2026-10-01", "PROJ-1");
    const file = await writeTicket(dir, issue, {
      baseUrl: "https://jira.example.com",
      repo: "owner/name",
      baseBranch: "main",
      branch: "feature/PROJ-1",
    });

    expect(file).toBe(path.join(dir, "ticket.md"));
    const text = await readFile(file, "utf8");
    expect(text.split("\n\n")[0]).toBe(
      [
        "- Repository: owner/name",
        "- Base branch: main",
        "- Branch: feature/PROJ-1",
        `- Run directory: ${dir}`,
      ].join("\n"),
    );
    expect(text).toContain("# PROJ-1: Add a health endpoint");
  });
});

describe("prompt", () => {
  it("names the ticket, the branch, and where the pull request text goes", () => {
    const text = prompt({ runDir: "/root/runs/2026-10-01/PROJ-1", branch: "feature/PROJ-1", baseBranch: "main" });
    expect(text).toContain("`/root/runs/2026-10-01/PROJ-1/ticket.md`");
    expect(text).toContain("branch `feature/PROJ-1` created from `main`");
    expect(text).toContain("`/root/runs/2026-10-01/PROJ-1/pr.md`");
    expect(text).toContain("Do not push, do not open a pull request");
    expect(text.split("\n")).toHaveLength(1);
  });
});

describe("parsePr", () => {
  it.each([
    ["plain title and body", "PROJ-1: thing\n\n## Summary\n\nDid it.\n", "PROJ-1: thing", "## Summary\n\nDid it."],
    ["heading stripped", "# PROJ-1: thing\n\nbody\n", "PROJ-1: thing", "body"],
    ["leading blank lines", "\n\n  PROJ-1: thing  \n\nbody", "PROJ-1: thing", "body"],
    ["title only", "PROJ-1: thing\n", "PROJ-1: thing", ""],
    ["a title that starts with a hash", "#1234 fix it\n\nbody", "#1234 fix it", "body"],
  ])("parses %s", (_name, text, title, body) => {
    expect(parsePr(text)).toEqual({ title, body });
  });

  it.each([
    ["empty", ""],
    ["only whitespace", "\n   \n\n"],
    ["a bare heading marker", "#\n\nbody\n"],
  ])("returns undefined for %s", (_name, text) => {
    expect(parsePr(text)).toBeUndefined();
  });
});

describe("readPr", () => {
  it("reads what the agent wrote and appends the footer", async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, "pr.md"), "# PROJ-1: add health endpoint\n\n## Summary\n\nAdded it.\n");

    const pr = await readPr(dir, fallback);
    expect(pr.title).toBe("PROJ-1: add health endpoint");
    expect(pr.body).toBe("## Summary\n\nAdded it.\n\n---\nJira: https://jira.example.com/browse/PROJ-1");
  });

  it.each([
    ["no pr.md at all", undefined],
    ["an empty pr.md", ""],
    ["a pr.md with no title", "\n\n"],
  ])("falls back for %s", async (_name, contents) => {
    const dir = await tempDir();
    if (contents !== undefined) await writeFile(path.join(dir, "pr.md"), contents);

    const pr = await readPr(dir, fallback);
    expect(pr.title).toBe("PROJ-1: Add a health endpoint");
    expect(pr.body).toContain("did not write a `pr.md`");
    expect(pr.body).toContain("Jira: https://jira.example.com/browse/PROJ-1");
  });
});
