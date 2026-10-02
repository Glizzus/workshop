import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { type State, readState, writeState } from "./state.js";

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "jira-ai-state-"));
}

const populated: State = {
  lastPrNight: "2026-10-01",
  failed: {
    "PROJ-1": { at: "2026-09-30T07:10:00.000Z", reason: "no changes produced" },
    "PROJ-2": { at: "2026-10-01T07:20:00.000Z", reason: "opencode exited 1" },
  },
};

describe("readState and writeState", () => {
  it("round trips", async () => {
    const dir = await tempDir();
    await writeState(dir, populated);
    await expect(readState(dir)).resolves.toEqual(populated);
  });

  it("treats a missing file as an empty state", async () => {
    const dir = await tempDir();
    await expect(readState(dir)).resolves.toEqual({ failed: {} });
  });

  it("creates the root directory on the way", async () => {
    const dir = await tempDir();
    const nested = path.join(dir, "a", "b");
    await writeState(nested, { failed: {} });
    await expect(readState(nested)).resolves.toEqual({ failed: {} });
  });

  it("writes indented JSON with a trailing newline", async () => {
    const dir = await tempDir();
    await writeState(dir, populated);
    const text = await readFile(path.join(dir, "state.json"), "utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('\n  "lastPrNight": "2026-10-01"');
  });

  it("lets a malformed file's error through rather than starting over", async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, "state.json"), "{ not json");
    await expect(readState(dir)).rejects.toThrow();
  });

  it.each([
    ["a night that is not a date", { lastPrNight: "not-a-date" }],
    ["a failure with no reason", { failed: { "PROJ-1": { at: "2026-10-01T07:30:00.000Z" } } }],
    ["a failure timed in no particular way", { failed: { "PROJ-1": { at: "tuesday", reason: "nope" } } }],
  ])("rejects %s", async (_name, contents) => {
    const dir = await tempDir();
    await writeFile(path.join(dir, "state.json"), JSON.stringify(contents));
    await expect(readState(dir)).rejects.toThrow();
  });
});
