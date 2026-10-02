import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  type OpencodeInvocation,
  instructionFiles,
  opencodeArgs,
  opencodeConfig,
  opencodeEnv,
  runOpencode,
} from "./opencode.js";

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "jira-ai-opencode-"));
}

/** A stand-in for `opencode`: ignores its arguments, writes to both streams, exits as told. */
async function script(dir: string, body: string): Promise<string> {
  const file = path.join(dir, "fake-opencode");
  await writeFile(file, `#!/bin/sh\n${body}\n`);
  await chmod(file, 0o755);
  return file;
}

function invocation(overrides: Partial<OpencodeInvocation> = {}): OpencodeInvocation {
  return {
    worktree: "/root/wt-PROJ-1",
    runDir: "/root/runs/2026-10-01/PROJ-1",
    prompt: "implement it",
    instructions: ["/skill/SKILL.md"],
    timeoutMinutes: 90,
    ...overrides,
  };
}

describe("opencodeArgs", () => {
  it("runs non-interactively in the worktree", () => {
    expect(opencodeArgs(invocation())).toEqual([
      "run",
      "--format",
      "json",
      "--auto",
      "--dir",
      "/root/wt-PROJ-1",
      "implement it",
    ]);
  });

  it("passes a model only when one is configured", () => {
    expect(opencodeArgs(invocation({ model: "ollama/qwen3-coder" }))).toEqual([
      "run",
      "--format",
      "json",
      "--auto",
      "--model",
      "ollama/qwen3-coder",
      "--dir",
      "/root/wt-PROJ-1",
      "implement it",
    ]);
  });
});

describe("opencodeConfig", () => {
  it("states the permissions instead of leaving them to be asked about", () => {
    expect(opencodeConfig(["/skill/SKILL.md"])).toEqual({
      instructions: ["/skill/SKILL.md"],
      permission: { edit: "allow", bash: "allow" },
    });
  });
});

describe("opencodeEnv", () => {
  const base: NodeJS.ProcessEnv = {
    PATH: "/usr/bin",
    HOME: "/home/daemon",
    JIRA_TOKEN: "jira-secret",
    GH_TOKEN: "github-secret",
  };

  it("strips the tokens the agent must not have", () => {
    const env = opencodeEnv(base, invocation());
    expect(env["JIRA_TOKEN"]).toBeUndefined();
    expect(env["GH_TOKEN"]).toBeUndefined();
    expect(env["PATH"]).toBe("/usr/bin");
    expect(env["HOME"]).toBe("/home/daemon");
    expect(base["GH_TOKEN"]).toBe("github-secret");
  });

  it("carries the config as JSON and sets the commit identity", () => {
    const env = opencodeEnv(base, invocation({ instructions: ["/skill/SKILL.md"] }));
    expect(JSON.parse(env["OPENCODE_CONFIG_CONTENT"] ?? "null")).toEqual({
      instructions: ["/skill/SKILL.md"],
      permission: { edit: "allow", bash: "allow" },
    });
    expect(env["GIT_AUTHOR_NAME"]).toBe("jira-ai-implementer");
    expect(env["GIT_AUTHOR_EMAIL"]).toBe("jira-ai-implementer@users.noreply.github.com");
    expect(env["GIT_COMMITTER_NAME"]).toBe("jira-ai-implementer");
    expect(env["GIT_COMMITTER_EMAIL"]).toBe("jira-ai-implementer@users.noreply.github.com");
  });
});

describe("runOpencode", () => {
  it("captures the exit code and both streams", async () => {
    const dir = await tempDir();
    const command = await script(dir, 'echo \'{"event":"done"}\'\necho "a warning" >&2\nexit 3');

    const result = await runOpencode(invocation({ worktree: dir, runDir: path.join(dir, "run") }), {
      command,
      env: { PATH: process.env["PATH"] ?? "/usr/bin" },
    });

    expect(result.code).toBe(3);
    expect(result.timedOut).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(await readFile(path.join(dir, "run", "opencode.jsonl"), "utf8")).toBe('{"event":"done"}\n');
    expect(await readFile(path.join(dir, "run", "opencode.stderr.log"), "utf8")).toBe("a warning\n");
  });

  it("kills the process group when the run takes too long", async () => {
    const dir = await tempDir();
    const command = await script(dir, "sleep 30");

    const result = await runOpencode(
      invocation({ worktree: dir, runDir: path.join(dir, "run"), timeoutMinutes: 0.01 }),
      { command, env: { PATH: process.env["PATH"] ?? "/usr/bin" }, killGraceMs: 500 },
    );

    expect(result.timedOut).toBe(true);
    expect(result.code === 0).toBe(false);
  }, 20_000);

  it("explains that opencode could not be started", async () => {
    const dir = await tempDir();
    await expect(
      runOpencode(invocation({ worktree: dir, runDir: path.join(dir, "run") }), {
        command: path.join(dir, "not-installed"),
      }),
    ).rejects.toThrow(/`opencode` could not be started.*not-installed/s);
  });
});

describe("instructionFiles", () => {
  it("resolves the installed skill", async () => {
    const files = await instructionFiles();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/implement-jira-issue.*SKILL\.md$/);
  });
});
