import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { branchFromHook, branchHookPath } from "./hooks.js";

const env = { ISSUE_KEY: "PROJ-7", REPO: "owner/name", BASE_BRANCH: "main" };

async function rootWithHook(script: string | undefined): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "jira-ai-hook-"));
  if (script !== undefined) {
    const hook = branchHookPath(root);
    await mkdir(path.dirname(hook), { recursive: true });
    await writeFile(hook, `#!/bin/sh\n${script}\n`);
    await chmod(hook, 0o755);
  }
  return root;
}

describe("branchFromHook", () => {
  it("fails without a hook", async () => {
    await expect(branchFromHook(await rootWithHook(undefined), env)).rejects.toThrow(/ENOENT/);
  });

  it("returns the branch the hook prints, trimmed, and tells it the issue", async () => {
    const root = await rootWithHook('echo "feature/$ISSUE_KEY-from-$BASE_BRANCH-of-$REPO"');
    expect(await branchFromHook(root, env)).toBe("feature/PROJ-7-from-main-of-owner/name");
  });

  it("fails on a non-zero exit", async () => {
    const root = await rootWithHook("echo nope >&2; exit 3");
    await expect(branchFromHook(root, env)).rejects.toThrow(/branch hook exited 3/);
  });

  it.each(["", "two words", "-leading", "a..b", "feature/PROJ-7 \nsecond line"])(
    "refuses %j as a branch name",
    async (printed) => {
      const root = await rootWithHook(`printf '%s' ${JSON.stringify(printed)}`);
      await expect(branchFromHook(root, env)).rejects.toThrow(/not a branch name/);
    },
  );

  it("refuses a branch that leaves the issue key out", async () => {
    const root = await rootWithHook("echo feature/something");
    await expect(branchFromHook(root, env)).rejects.toThrow(/does not contain PROJ-7/);
  });
});
