// One attempt at one issue, from fetching the base branch to the pull request.
// Everything with an effect arrives as a dependency, so the whole sequence --
// including each of the ways it can go wrong -- can be played out against
// fakes.
//
// Nothing here talks to Jira. The issue is read once, before the attempt, and
// the attempt's own record is the pull request on GitHub plus, for a failure,
// a line in the daemon's state file.

import path from "node:path";

import type { Git } from "@glizzus/git";
import type { GitHubClient } from "@glizzus/github";
import type { Issue } from "@glizzus/jira";

import type { Config } from "./config.js";
import type { CreateBranchEnv } from "./hooks.js";
import { runDir, worktreeDir } from "./layout.js";
import type { OpencodeInvocation, OpencodeResult } from "./opencode.js";
import { branchMentions } from "./select.js";
import { type State, writeState } from "./state.js";
import { prompt, readPr, writeTicket } from "./ticket.js";

/** The outside world, as an attempt uses it. */
export interface Deps {
  /** The bare clone at `<root>/repo.git`; worktrees are cut from it. */
  git: Git;
  github: GitHubClient;
  /** The operator's `hooks/create-branch`, run when origin has no branch for the issue yet. */
  createBranchHook: (root: string, env: CreateBranchEnv) => Promise<boolean>;
  opencode: (inv: OpencodeInvocation) => Promise<OpencodeResult>;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  log: (message: string) => void;
}

/** Everything about the run that is not about this one issue. `state` is mutated in place. */
export interface AttemptContext {
  config: Config;
  /** The directory the daemon owns. */
  root: string;
  /** `YYYY-MM-DD`, the night this attempt belongs to. */
  night: string;
  state: State;
  /** Instruction files for OpenCode, the skill first. */
  instructions: string[];
}

/** How an attempt ended. A failure is reported, not thrown. */
export type AttemptResult = { outcome: "pr"; prUrl: string } | { outcome: "failed"; reason: string };

/**
 * Tries to turn one issue into a pull request.
 *
 * Nothing here throws: a git or GitHub error becomes a failed outcome carrying the error's own
 * message, which is what lands in the state file. The daemon's next move is the same either way --
 * try the next ticket -- and an exception would only make that harder to arrange.
 *
 * A failed key is remembered so the next poll skips it. Deleting it from `state.json` is how the
 * operator says to try again, which is deliberately a decision rather than a retry loop: a ticket
 * the agent cannot do would otherwise eat every night.
 */
export async function attempt(deps: Deps, ctx: AttemptContext, issue: Issue): Promise<AttemptResult> {
  const { config, root, night, state } = ctx;
  const key = issue.key;
  const summary = issue.fields.summary;
  const wt = worktreeDir(root, key);
  const run = runDir(root, night, key);
  const base = config.repo.baseBranch;

  let branch: string | undefined;
  let result: AttemptResult;
  try {
    deps.log(`${key}: ${summary}`);
    branch = await findBranch(deps, ctx, key);
    result = await implement(deps, ctx, issue, { branch, wt, run });
  } catch (error) {
    result = { outcome: "failed", reason: message(error) };
  }

  if (result.outcome === "failed") deps.log(`${key}: failed: ${result.reason}`);
  await cleanup(deps, wt, branch, key);

  if (result.outcome === "pr") {
    state.lastPrNight = night;
    delete state.failed[key];
  } else {
    state.failed[key] = { at: deps.now().toISOString(), reason: result.reason };
  }
  try {
    await writeState(root, state);
  } catch (error) {
    deps.log(`${key}: could not write state: ${message(error)}`);
  }
  return result;
}

/** How long to wait for the hook's branch to show up on origin, and how often to look. */
const BRANCH_WAIT_MS = 2 * 60 * 1000;
const BRANCH_POLL_MS = 5 * 1000;

/**
 * The branch on origin for this issue: the one whose name contains the key. When there is none,
 * the operator's `hooks/create-branch` is asked to make one and origin is watched until it appears.
 * The daemon never names a branch itself; whoever makes it puts the key in the name, and that same
 * rule is what later marks the issue as done from its pull request.
 */
async function findBranch(deps: Deps, ctx: AttemptContext, key: string): Promise<string> {
  const { config, root } = ctx;
  const found = await branchOn(deps, key);
  if (found) return found;

  const ran = await deps.createBranchHook(root, {
    ISSUE_KEY: key,
    REPO: config.repo.github,
    BASE_BRANCH: config.repo.baseBranch,
  });
  if (!ran) throw new Error(`no branch for ${key} on origin, and no hooks/create-branch to make one`);

  const deadline = deps.now().getTime() + BRANCH_WAIT_MS;
  while (deps.now().getTime() < deadline) {
    await deps.sleep(BRANCH_POLL_MS);
    const appeared = await branchOn(deps, key);
    if (appeared) return appeared;
  }
  throw new Error(`no branch for ${key} appeared on origin within ${String(BRANCH_WAIT_MS / 60_000)} minutes`);
}

/** The first branch on origin whose name contains `key`, logging the others if there are several. */
async function branchOn(deps: Deps, key: string): Promise<string | undefined> {
  const matching = (await deps.git.remoteHeads("origin")).filter((name) => branchMentions(name, key));
  const [first, ...rest] = matching;
  if (first !== undefined && rest.length > 0) {
    deps.log(`${key}: several branches on origin carry the key, using ${first} over ${rest.join(", ")}`);
  }
  return first;
}

interface Paths {
  /** The branch on origin the work starts from, is pushed to, and the pull request is opened from. */
  branch: string;
  wt: string;
  run: string;
}

/**
 * The attempt itself. Every step that cannot be recovered from throws or returns a failure, and
 * {@link attempt} is what turns either into an outcome and tidies up after it.
 */
async function implement(
  deps: Deps,
  ctx: AttemptContext,
  issue: Issue,
  paths: Paths,
): Promise<AttemptResult> {
  const { config, root, night } = ctx;
  const { branch, wt, run } = paths;
  const base = config.repo.baseBranch;
  const startRef = `refs/remotes/origin/${branch}`;
  const key = issue.key;
  const summary = issue.fields.summary;

  await deps.git.fetch("origin", `+refs/heads/${branch}:${startRef}`);

  // A worktree or branch left over from a crashed run, rather than from this one: take it off and
  // start from the base branch, because a half-finished tree is not a head start.
  const worktrees = await deps.git.worktreeList();
  if (worktrees.some((worktree) => worktree.path === wt)) {
    await deps.git.worktreeRemove(wt, { force: true });
  }
  try {
    await deps.git.branchDelete(branch, { force: true });
  } catch {
    // There is usually no such branch, which is the point of asking.
  }

  const work = await deps.git.worktreeAdd(wt, startRef, { branch });

  await writeTicket(run, issue, {
    baseUrl: config.jira.baseUrl,
    repo: config.repo.github,
    baseBranch: base,
    branch,
  });

  const result = await deps.opencode({
    worktree: wt,
    runDir: run,
    prompt: prompt({ runDir: run, branch, baseBranch: base }),
    model: config.opencode.model,
    instructions: ctx.instructions,
    timeoutMinutes: config.opencode.timeoutMinutes,
  });
  if (result.timedOut) {
    const minutes = String(config.opencode.timeoutMinutes);
    return { outcome: "failed", reason: `opencode timed out after ${minutes} minutes` };
  }
  if (result.code !== 0) {
    const how = result.code === null ? String(result.signal) : String(result.code);
    const log = path.join(run, "opencode.stderr.log");
    return { outcome: "failed", reason: `opencode exited ${how} (see ${log})` };
  }

  // Either uncommitted work or commits of its own counts as a result; neither means the agent read
  // the ticket and did nothing, which is the one outcome no pull request can describe.
  const dirty = (await work.status()).length > 0;
  const commits = await work.revListCount(`${startRef}..HEAD`);
  if (!dirty && commits === 0) return { outcome: "failed", reason: "no changes produced" };

  if (dirty) {
    await work.add({ all: true });
    await work.commit(`${key}: ${summary}`);
  }
  await work.push("origin", branch, { setUpstream: true });

  const issueUrl = `${config.jira.baseUrl.replace(/\/+$/, "")}/browse/${key}`;
  const { title, body } = await readPr(run, { key, summary, issueUrl });
  // Always a draft: nobody has read a line of this yet, and a draft says so on GitHub itself.
  const pr = await deps.github.createPullRequest(config.repo.github, {
    title,
    head: branch,
    base,
    body,
    draft: true,
  });
  deps.log(`${key}: opened ${pr.html_url} (run ${night} under ${root})`);
  return { outcome: "pr", prUrl: pr.html_url };
}

/**
 * Removes the worktree and the local branch. The remote branch is left alone: on the success path
 * the pull request is using it, and on the failure path the push either never happened or is worth
 * looking at. Both failures are logged rather than raised -- the attempt is over either way, and a
 * worktree that will not go is the operator's problem, not the next ticket's.
 */
async function cleanup(deps: Deps, worktree: string, branch: string | undefined, key: string): Promise<void> {
  try {
    await deps.git.worktreeRemove(worktree, { force: true });
  } catch (error) {
    deps.log(`${key}: could not remove ${worktree}: ${message(error)}`);
  }
  if (branch === undefined) return;
  try {
    await deps.git.branchDelete(branch, { force: true });
  } catch (error) {
    deps.log(`${key}: could not delete ${branch}: ${message(error)}`);
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
