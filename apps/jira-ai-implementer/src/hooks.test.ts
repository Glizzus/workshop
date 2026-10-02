import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createBranchHookPath, runCreateBranchHook } from "./hooks.js";

const env = { ISSUE_KEY: "PROJ-7", REPO: "owner/name", BASE_BRANCH: "main" };

async function rootWithHook(script: string | undefined): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "jira-ai-hook-"));
  if (script !== undefined) {
    const hook = createBranchHookPath(root);
    await mkdir(path.dirname(hook), { recursive: true });
    await writeFile(hook, `#!/bin/sh\n${script}\n`);
    await chmod(hook, 0o755);
  }
  return root;
}

describe("runCreateBranchHook", () => {
  it("does nothing without a hook", async () => {
    expect(await runCreateBranchHook(await rootWithHook(undefined), env)).toBe(false);
  });

  it("runs the hook with the issue in its environment and ignores what it prints", async () => {
    const root = await rootWithHook('test "$ISSUE_KEY" = PROJ-7 && test "$REPO" = owner/name && echo "<html>whatever</html>"');
    expect(await runCreateBranchHook(root, env)).toBe(true);
  });

  it("fails on a non-zero exit", async () => {
    const root = await rootWithHook("exit 3");
    await expect(runCreateBranchHook(root, env)).rejects.toThrow(/create-branch hook exited 3/);
  });
});
