// Running the implementer. OpenCode is configured entirely through argv and the
// environment -- never through a file in the repository -- so a target repo's
// own `opencode.json` cannot decide what the daemon's agent is allowed to do,
// and nothing about the daemon has to be committed to the repository.
//
// The three pure pieces (argv, config, env) are what a first install has to be
// checked against, so they are separated from the spawning and tested on their
// own.

import { spawn } from "node:child_process";
import { createWriteStream, type WriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The identity every commit is attributed to, the daemon's own and anything the agent commits for
 * itself. A constant so the history reads the same wherever the daemon happens to run.
 */
export const GIT_IDENTITY = {
  name: "jira-ai-implementer",
  email: "jira-ai-implementer@users.noreply.github.com",
} as const;

/** One run of OpenCode against one prepared worktree. */
export interface OpencodeInvocation {
  /** Working directory: the worktree the issue is being implemented in. */
  worktree: string;
  /** Where the transcript and stderr are written. */
  runDir: string;
  prompt: string;
  /** `provider/model`, as OpenCode names them. Omitted leaves the operator's default in place. */
  model?: string | undefined;
  /** Absolute paths of instruction files, the skill first. */
  instructions: string[];
  /** Wall-clock budget for the whole run. */
  timeoutMinutes: number;
}

/** What OpenCode's config file would have said, handed over as an environment variable instead. */
export interface OpencodeConfig {
  instructions: string[];
  permission: { edit: "allow"; bash: "allow" };
}

/** How a finished run ended. */
export interface OpencodeResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  /** True when the run was killed for exceeding {@link OpencodeInvocation.timeoutMinutes}. */
  timedOut: boolean;
  durationMs: number;
}

/** Options for {@link runOpencode}, all of them seams for tests. */
export interface RunOpencodeOptions {
  /** Defaults to `opencode` on PATH. */
  command?: string;
  /** The environment to derive the child's from; defaults to this process's. */
  env?: NodeJS.ProcessEnv;
  /** How long SIGTERM is given before SIGKILL follows. Defaults to 15 s. */
  killGraceMs?: number;
}

/**
 * OpenCode's argv. `run` is its non-interactive mode, `--format json` makes the transcript
 * machine-readable, and `--auto` answers the permission prompts that a daemon has nobody to show.
 */
export function opencodeArgs(inv: OpencodeInvocation): string[] {
  return [
    "run",
    "--format",
    "json",
    "--auto",
    ...(inv.model ? ["--model", inv.model] : []),
    "--dir",
    inv.worktree,
    inv.prompt,
  ];
}

/**
 * The configuration layered over the operator's global OpenCode config. Permissions are stated
 * rather than left to the default, because a repository being worked on may carry an
 * `opencode.json` of its own that asks for confirmation, and there is nobody to confirm.
 */
export function opencodeConfig(instructions: string[]): OpencodeConfig {
  return { instructions, permission: { edit: "allow", bash: "allow" } };
}

/**
 * The child's environment. The tokens are removed rather than merely unused: the agent runs shell
 * commands, so the only reliable way to keep it from pushing or from touching the ticket is for
 * the credentials not to be there. Git identity is set so any commit it chooses to make is
 * attributed the same way the daemon's own commit would be.
 */
export function opencodeEnv(base: NodeJS.ProcessEnv, inv: OpencodeInvocation): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  delete env["JIRA_TOKEN"];
  delete env["GH_TOKEN"];
  env["OPENCODE_CONFIG_CONTENT"] = JSON.stringify(opencodeConfig(inv.instructions));
  env["GIT_AUTHOR_NAME"] = GIT_IDENTITY.name;
  env["GIT_AUTHOR_EMAIL"] = GIT_IDENTITY.email;
  env["GIT_COMMITTER_NAME"] = GIT_IDENTITY.name;
  env["GIT_COMMITTER_EMAIL"] = GIT_IDENTITY.email;
  return env;
}

/**
 * Runs OpenCode to completion, or kills it when it runs long.
 *
 * The child leads its own process group (`detached`), because what has to die on a timeout is not
 * OpenCode but whatever it started -- a test run, a dev server, a package install -- and only a
 * group-wide signal reaches those. SIGTERM goes first so a model mid-tool-call can unwind, then
 * SIGKILL after the grace period for the ones that do not.
 *
 * Rejects only when the command could not be started; a non-zero exit is a result, not an error,
 * because the attempt has to be reported rather than thrown.
 */
export async function runOpencode(
  inv: OpencodeInvocation,
  options: RunOpencodeOptions = {},
): Promise<OpencodeResult> {
  await mkdir(inv.runDir, { recursive: true });
  const command = options.command ?? "opencode";
  const startedAt = Date.now();
  const out = createWriteStream(path.join(inv.runDir, "opencode.jsonl"));
  const err = createWriteStream(path.join(inv.runDir, "opencode.stderr.log"));

  return new Promise<OpencodeResult>((resolve, reject) => {
    out.on("error", reject);
    err.on("error", reject);

    const child = spawn(command, opencodeArgs(inv), {
      cwd: inv.worktree,
      env: opencodeEnv(options.env ?? process.env, inv),
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.pipe(out);
    child.stderr.pipe(err);

    let timedOut = false;
    let graceTimer: NodeJS.Timeout | undefined;

    /** Signals the whole process group; it is gone already if this throws, which is the goal. */
    const signalGroup = (signal: NodeJS.Signals): void => {
      if (child.pid === undefined) return;
      try {
        process.kill(-child.pid, signal);
      } catch {
        // Already dead, or never started.
      }
    };

    const timer = setTimeout(
      () => {
        timedOut = true;
        signalGroup("SIGTERM");
        graceTimer = setTimeout(() => signalGroup("SIGKILL"), options.killGraceMs ?? 15_000);
      },
      inv.timeoutMinutes * 60_000,
    );

    const stopTimers = (): void => {
      clearTimeout(timer);
      if (graceTimer) clearTimeout(graceTimer);
    };

    child.on("error", (error: NodeJS.ErrnoException) => {
      stopTimers();
      out.destroy();
      err.destroy();
      reject(
        error.code === "ENOENT"
          ? new Error(
              `\`opencode\` could not be started: no such command ${JSON.stringify(command)}. ` +
                `Install OpenCode and make sure it is on the daemon's PATH.`,
            )
          : error,
      );
    });

    child.on("close", (code, signal) => {
      stopTimers();
      const result: OpencodeResult = { code, signal, timedOut, durationMs: Date.now() - startedAt };
      // The logs are read by the failure path, so wait for them to reach disk before saying so.
      void Promise.all([closed(out), closed(err)]).then(() => resolve(result));
    });
  });
}

/** Resolves once a write stream has finished, immediately if it already has. */
function closed(stream: WriteStream): Promise<void> {
  if (stream.closed) return Promise.resolve();
  return new Promise((resolve) => stream.once("close", () => resolve()));
}

/**
 * The instruction files OpenCode is given: the skill, resolved through its own package so the
 * daemon and the skill stay in step.
 */
export async function instructionFiles(): Promise<string[]> {
  const skill = fileURLToPath(import.meta.resolve("@glizzus/implement-jira-issue/dist/SKILL.md"));
  try {
    await access(skill);
  } catch {
    throw new Error(
      `the implement-jira-issue skill is not at ${skill}: build it with ` +
        `\`pnpm --filter @glizzus/implement-jira-issue build\``,
    );
  }
  return [skill];
}
