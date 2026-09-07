import { gitRunner, type RunOptions, type Runner } from "./run.js";
import { parseWorktreeList, type Worktree } from "./worktree-list.js";

/** Options for {@link Git.worktreeAdd}. */
export interface WorktreeAddOptions {
  /**
   * Check out `ref` as a detached HEAD instead of creating a branch. What a
   * throwaway environment wants: nothing to clean up in `refs/heads`.
   */
  detach?: boolean;
}

/** Options for {@link Git.worktreeRemove}. */
export interface WorktreeRemoveOptions {
  /** Remove even when the worktree is dirty or locked. */
  force?: boolean;
}

/** Options for {@link Git.checkout}. */
export interface CheckoutOptions {
  detach?: boolean;
}

/** Options for {@link Git.clone}. */
export interface CloneOptions {
  /** `--bare`: no working tree. Enough when every checkout is a worktree. */
  bare?: boolean;
}

/**
 * A `key=value` pair passed as `git -c key=value`. Order matters: git applies
 * them in sequence, so an empty value first resets a multi-valued key.
 */
export type ConfigEntry = readonly [key: string, value: string];

/** How a {@link Git} runs git. */
export interface GitOptions {
  /** Executes git; defaults to spawning the `git` on PATH. */
  runner?: Runner;
  /**
   * Configuration applied to every invocation via `-c`, without touching
   * any config file. For settings the process must own, such as a
   * credential helper that reads a token from the environment.
   */
  config?: readonly ConfigEntry[];
}

/**
 * One repository, addressed by a directory that git can resolve to it: the
 * main checkout or any of its worktrees. Methods mirror git subcommands and
 * return parsed output; failures surface as {@link GitError}.
 */
export class Git {
  readonly dir: string;
  readonly #options: GitOptions;

  constructor(dir: string, options: GitOptions = {}) {
    this.dir = dir;
    this.#options = options;
  }

  /**
   * `git clone [--bare] <url> <dir>`, returning a `Git` for the clone. The
   * parent of `dir` must exist; git creates `dir` itself.
   */
  static async clone(url: string, dir: string, options: CloneOptions & GitOptions = {}): Promise<Git> {
    const { bare, ...rest } = options;
    const git = new Git(dir, rest);
    await git.#run(bare ? ["clone", "--bare", url, dir] : ["clone", url, dir]);
    return git;
  }

  /** A `Git` for another directory of the same repository, sharing runner and config. */
  at(dir: string): Git {
    return new Git(dir, this.#options);
  }

  /**
   * `git fetch <remote> [<refspec>]`. Without a refspec, updates the remote's
   * tracking refs. With one such as `pull/7/head`, the result is left in
   * `FETCH_HEAD` and nothing else is written unless the refspec has a
   * destination (`pull/7/head:refs/remotes/origin/pr/7`).
   */
  async fetch(remote: string, refspec?: string): Promise<void> {
    await this.#git(refspec === undefined ? ["fetch", remote] : ["fetch", remote, refspec]);
  }

  /** `git checkout [--detach] <ref>` in this directory. */
  async checkout(ref: string, options: CheckoutOptions = {}): Promise<void> {
    await this.#git(options.detach ? ["checkout", "--detach", ref] : ["checkout", ref]);
  }

  /** `git worktree add [--detach] <path> <ref>`, returning a `Git` for the new worktree. */
  async worktreeAdd(path: string, ref: string, options: WorktreeAddOptions = {}): Promise<Git> {
    await this.#git(
      options.detach ? ["worktree", "add", "--detach", path, ref] : ["worktree", "add", path, ref],
    );
    return this.at(path);
  }

  /** `git worktree remove [--force] <path>`. */
  async worktreeRemove(path: string, options: WorktreeRemoveOptions = {}): Promise<void> {
    await this.#git(
      options.force ? ["worktree", "remove", "--force", path] : ["worktree", "remove", path],
    );
  }

  /** `git worktree list --porcelain`, parsed. The main worktree is first. */
  async worktreeList(): Promise<Worktree[]> {
    const { stdout } = await this.#git(["worktree", "list", "--porcelain"]);
    return parseWorktreeList(stdout);
  }

  #git(args: readonly string[]): ReturnType<Runner> {
    return this.#run(args, { cwd: this.dir });
  }

  /** Runs git with the configured `-c` entries prepended. */
  #run(args: readonly string[], options?: RunOptions): ReturnType<Runner> {
    const config = (this.#options.config ?? []).flatMap(([key, value]) => ["-c", `${key}=${value}`]);
    return (this.#options.runner ?? gitRunner)([...config, ...args], options);
  }
}
