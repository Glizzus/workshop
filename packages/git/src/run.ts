import { spawn } from "node:child_process";

/** Options for a single git invocation. */
export interface RunOptions {
  /** Working directory. Git resolves the repository from here. */
  cwd?: string;
}

/** Captured output of a git invocation that exited 0. */
export interface RunResult {
  stdout: string;
  stderr: string;
}

/**
 * Runs git with `args` and resolves with its output, or rejects with a
 * {@link GitError} when it exits non-zero. Injected into {@link Git} so tests
 * can substitute a fake.
 */
export type Runner = (args: readonly string[], options?: RunOptions) => Promise<RunResult>;

/** Thrown when git exits non-zero. */
export class GitError extends Error {
  readonly args: readonly string[];
  readonly code: number | null;
  readonly stderr: string;

  constructor(args: readonly string[], code: number | null, stderr: string) {
    super(`git ${args.join(" ")} exited ${String(code)}: ${stderr.trim()}`);
    this.name = "GitError";
    this.args = args;
    this.code = code;
    this.stderr = stderr;
  }
}

/** The default runner: spawns the `git` on PATH. */
export const gitRunner: Runner = (args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new GitError(args, code, stderr));
    });
  });
