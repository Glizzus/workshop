import { gitRunner, type RunOptions, type Runner } from "./run.js";
import { parseRemoteHeads } from "./remote-heads.js";
import { parseStatus, type StatusEntry } from "./status.js";
import { parseWorktreeList, type Worktree } from "./worktree-list.js";

/** Options for {@link Git.worktreeAdd}. */
export interface WorktreeAddOptions {
  /**
   * `-b`: create this branch at `ref` and check it out. The branch must not
   * already exist, and it outlives the worktree, so a caller that wanted it
   * only for one run deletes it with {@link Git.branchDelete} afterwards.
   * Mutually exclusive with {@link WorktreeAddOptions.detach}.
   */
  branch?: string;
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
  /** `--force`: throw away local changes to tracked files instead of refusing. */
  force?: boolean;
}

/** Options for {@link Git.clean}. Always `-f`; git refuses to clean without it. */
export interface CleanOptions {
  /** `-d`: remove untracked directories too. */
  directories?: boolean;
  /** `-x`: remove ignored files too, not only untracked ones. */
  ignored?: boolean;
}

/** Options for {@link Git.clone}. */
export interface CloneOptions {
  /** `--bare`: no working tree. Enough when every checkout is a worktree. */
  bare?: boolean;
}

/** Options for {@link Git.add}. */
export interface AddOptions {
  /** `--all`: stage every change in the worktree, deletions included. */
  all?: boolean;
}

/** Options for {@link Git.push}. */
export interface PushOptions {
  /** `--set-upstream`: record the pushed remote branch as this branch's upstream. */
  setUpstream?: boolean;
}

/** Options for {@link Git.branchDelete}. */
export interface BranchDeleteOptions {
  /** `--force`: delete even a branch whose commits are not merged anywhere. */
  force?: boolean;
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

  /** `git checkout [--force] [--detach] <ref>` in this directory. */
  async checkout(ref: string, options: CheckoutOptions = {}): Promise<void> {
    const flags = [...(options.force ? ["--force"] : []), ...(options.detach ? ["--detach"] : [])];
    await this.#git(["checkout", ...flags, ref]);
  }

  /** `git clean -f[d][x]` in this directory. */
  async clean(options: CleanOptions = {}): Promise<void> {
    await this.#git(["clean", `-f${options.directories ? "d" : ""}${options.ignored ? "x" : ""}`]);
  }

  /**
   * `git worktree add [-b <branch>] [--detach] <path> <ref>`, returning a `Git`
   * for the new worktree. `branch` and `detach` are the two ways to decide what
   * HEAD points at, so asking for both is a mistake rather than a preference.
   */
  async worktreeAdd(path: string, ref: string, options: WorktreeAddOptions = {}): Promise<Git> {
    if (options.branch !== undefined && options.detach) {
      throw new Error("worktree add cannot both create a branch and detach HEAD");
    }
    const flags =
      options.branch !== undefined ? ["-b", options.branch] : options.detach ? ["--detach"] : [];
    await this.#git(["worktree", "add", ...flags, path, ref]);
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

  /**
   * `git worktree prune`: forget administrative entries for worktrees whose
   * directories are gone. A cleanup that removed a worktree's directory without
   * `worktree remove` leaves exactly that behind.
   */
  async worktreePrune(): Promise<void> {
    await this.#git(["worktree", "prune"]);
  }

  /**
   * `git ls-remote --heads <remote>`, parsed to branch names. Asks the remote
   * directly, so it sees a branch the moment it exists, without fetching.
   */
  async remoteHeads(remote: string): Promise<string[]> {
    const { stdout } = await this.#git(["ls-remote", "--heads", remote]);
    return parseRemoteHeads(stdout);
  }

  /** `git status --porcelain`, parsed. An empty array means a clean worktree. */
  async status(): Promise<StatusEntry[]> {
    const { stdout } = await this.#git(["status", "--porcelain"]);
    return parseStatus(stdout);
  }

  /**
   * `git add --all`: stages every change, deletions included. Only `all` is
   * supported for now; anything narrower would need pathspecs, which no caller
   * has asked for, so an options object without it is an error rather than a
   * silent no-op.
   */
  async add(options: AddOptions): Promise<void> {
    if (!options.all) throw new Error("git add supports only the `all` option for now");
    await this.#git(["add", "--all"]);
  }

  /**
   * `git commit -m <message>`. Identity is not an argument: git reads it from
   * config, so a caller with no `user.name` and `user.email` on the machine
   * passes them as {@link GitOptions.config} entries (`["user.name", "..."]`,
   * `["user.email", "..."]`), which this prepends as `-c` on every invocation.
   */
  async commit(message: string): Promise<void> {
    await this.#git(["commit", "-m", message]);
  }

  /** `git push [--set-upstream] <remote> <refspec>`. */
  async push(remote: string, refspec: string, options: PushOptions = {}): Promise<void> {
    const flags = options.setUpstream ? ["--set-upstream"] : [];
    await this.#git(["push", ...flags, remote, refspec]);
  }

  /** `git branch --delete [--force] <name>`. */
  async branchDelete(name: string, options: BranchDeleteOptions = {}): Promise<void> {
    const flags = options.force ? ["--force"] : [];
    await this.#git(["branch", "--delete", ...flags, name]);
  }

  /**
   * `git rev-list --count <range>`: how many commits `range` names, so
   * `origin/main..HEAD` answers whether there is anything to push.
   */
  async revListCount(range: string): Promise<number> {
    const { stdout } = await this.#git(["rev-list", "--count", range]);
    const count = Number.parseInt(stdout.trim(), 10);
    if (Number.isNaN(count)) throw new Error(`git rev-list --count ${range} printed ${stdout.trim()}`);
    return count;
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
