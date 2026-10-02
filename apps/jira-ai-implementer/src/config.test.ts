import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { Config, loadConfig } from "./config.js";

/** Only the fields with no default: everything else must be filled in for us. */
const minimal = {
  jira: { baseUrl: "https://jira.example.com", project: "PROJ" },
  repo: { github: "owner/name" },
  window: { timezone: "America/Chicago" },
};

/** Every field spelled out, as the README's example writes it. */
const full = {
  jira: { baseUrl: "https://jira.example.com", project: "PROJ", label: "auto-ai-implement" },
  repo: { github: "owner/name", baseBranch: "main" },
  window: { timezone: "America/Chicago", start: "02:00", end: "04:00" },
  opencode: { model: "ollama/qwen3-coder", timeoutMinutes: 90 },
};

const withJira = (patch: Record<string, unknown>): unknown => ({ ...minimal, jira: { ...minimal.jira, ...patch } });
const withRepo = (patch: Record<string, unknown>): unknown => ({ ...minimal, repo: { ...minimal.repo, ...patch } });
const withWindow = (patch: Record<string, unknown>): unknown => ({
  ...minimal,
  window: { ...minimal.window, ...patch },
});

describe("Config", () => {
  it("accepts a fully specified config unchanged", () => {
    expect(Config.parse(full)).toEqual(full);
  });

  it("fills in every default from the minimal config", () => {
    expect(Config.parse(minimal)).toEqual({
      jira: { baseUrl: "https://jira.example.com", project: "PROJ", label: "auto-ai-implement" },
      repo: { github: "owner/name", baseBranch: "main" },
      window: { timezone: "America/Chicago", start: "02:00", end: "04:00" },
      opencode: { timeoutMinutes: 90 },
    });
  });

  // zod's `.default({})` would hand back a bare `{}` here instead of parsing it
  // through the section, so this assertion is what pins `.prefault({})`.
  it("applies the defaults inside an opencode section that is given only in part", () => {
    const parsed = Config.parse({ ...minimal, opencode: { model: "ollama/qwen3-coder" } });
    expect(parsed.opencode).toEqual({ model: "ollama/qwen3-coder", timeoutMinutes: 90 });
  });

  const failures: { name: string; input: unknown; at: string; message?: string }[] = [
    {
      name: "a start time that is not on the clock",
      input: withWindow({ start: "24:00" }),
      at: "window.start",
      message: "must be HH:MM on a 24-hour clock",
    },
    {
      name: "a window that starts and ends at the same time",
      input: withWindow({ start: "02:00", end: "02:00" }),
      at: "window",
      message: "window start and end must differ",
    },
    {
      name: "a time zone nobody has heard of",
      input: withWindow({ timezone: "Mars/Olympus" }),
      at: "window.timezone",
      message: "unknown IANA time zone",
    },
    {
      name: "a label containing whitespace",
      input: withJira({ label: "has space" }),
      at: "jira.label",
      message: "must not contain whitespace",
    },
    { name: "a base URL that is not a URL", input: withJira({ baseUrl: "nope" }), at: "jira.baseUrl" },
    {
      name: "a repository that is not owner/name",
      input: withRepo({ github: "ownername" }),
      at: "repo.github",
      message: 'repository must be owner/name, got "ownername"',
    },
    {
      name: "a timeout of zero",
      input: { ...minimal, opencode: { timeoutMinutes: 0 } },
      at: "opencode.timeoutMinutes",
    },
  ];

  it.each(failures)("rejects $name", ({ input, at, message }) => {
    const result = Config.safeParse(input);
    expect(result.success).toBe(false);
    const issue = result.success ? undefined : result.error.issues[0];
    expect(issue?.path.join(".")).toBe(at);
    if (message !== undefined) expect(issue?.message).toBe(message);
  });

  it.each(["jira", "repo", "window"])("requires the %s section", (section) => {
    const input: Record<string, unknown> = { ...minimal };
    delete input[section];
    expect(Config.safeParse(input).success).toBe(false);
  });
});

describe("loadConfig", () => {
  async function tempDir(): Promise<string> {
    return mkdtemp(path.join(os.tmpdir(), "jira-ai-config-"));
  }

  it("reads and validates a config file", async () => {
    const dir = await tempDir();
    const file = path.join(dir, "config.json");
    await writeFile(file, JSON.stringify(minimal));
    await expect(loadConfig(file)).resolves.toEqual(Config.parse(minimal));
  });

  it("lets a malformed file's error through", async () => {
    const dir = await tempDir();
    const file = path.join(dir, "config.json");
    await writeFile(file, "{ not json");
    await expect(loadConfig(file)).rejects.toThrow();
  });

  it("lets a missing file's error through", async () => {
    const dir = await tempDir();
    await expect(loadConfig(path.join(dir, "nope.json"))).rejects.toThrow();
  });
});
