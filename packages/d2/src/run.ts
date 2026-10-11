import { spawn } from "node:child_process";

/** Captured output of one d2 invocation. */
export interface RunResult {
  /** Exit code; null if d2 was killed by a signal. */
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Runs d2 with `args` and resolves with its output and exit code. A non-zero
 * exit resolves too: a compile error is an answer, not a failure. Rejects only
 * when d2 cannot be started at all; see {@link D2NotFoundError}. Injected into
 * {@link D2} so tests can substitute a fake.
 */
export type Runner = (args: readonly string[]) => Promise<RunResult>;

/** Thrown when the d2 binary cannot be found. */
export class D2NotFoundError extends Error {
  readonly bin: string;

  constructor(bin: string) {
    super(`d2 not found: ${bin}`);
    this.name = "D2NotFoundError";
    this.bin = bin;
  }
}

/** A runner that spawns `bin`: by default `$D2_BIN`, else the `d2` on PATH. */
export function d2Runner(bin = process.env["D2_BIN"] || "d2"): Runner {
  return (args) =>
    new Promise((resolve, reject) => {
      const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
      child.on("error", (err: NodeJS.ErrnoException) =>
        reject(err.code === "ENOENT" || err.code === "EACCES" ? new D2NotFoundError(bin) : err),
      );
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
}
