import { gitRunner, type Runner } from "./run.js";
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

/**
 * One repository, addressed by a directory that git can resolve to it: the
 * main checkout or any of its worktrees. Methods mirror git subcommands and
 * return parsed output; failures surface as {@link GitError}.
 */
export class Git {
  readonly dir: string;
  readonly #run: Runner;

  constructor(dir: string, runner: Runner = gitRunner) {
    this.dir = dir;
    this.#run = runner;
  }

  /** A `Git` for another directory of the same repository, sharing the runner. */
  at(dir: string): Git {
    return new Git(dir, this.#run);
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
}
