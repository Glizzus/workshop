#!/usr/bin/env node
// Picks one labelled Jira issue a night, implements it with OpenCode in a git
// worktree, and opens a draft pull request for it. The daemon runs all day but
// only starts work inside the nightly window the configuration names; once a
// pull request is open, that night is done. Jira is only ever read: the pull
// requests on GitHub are the record of what has been dealt with, so nothing is
// written back to the ticket.
//
//   jira-ai-implementer <config.json> [dir] [--once] [--now] [--issue KEY]
//
// Everything lives under `dir`, which defaults to `./<repo name>`:
//
//   repo.git                                a bare clone of the repository
//   wt-<KEY>                                the worktree for an attempt, removed after it
//   runs/<night>/<KEY>/ticket.md            the issue, as the agent reads it
//   runs/<night>/<KEY>/pr.md                the pull request text, as the agent wrote it
//   runs/<night>/<KEY>/opencode.jsonl       the agent's transcript
//   runs/<night>/<KEY>/opencode.stderr.log  the agent's stderr
//   state.json                              the night that got its pull request, and failed keys
//   hooks/branch                            yours: prints the branch on origin to work on
//
// JIRA_TOKEN and GH_TOKEN must be set; GH_TOKEN authenticates both the GitHub
// API and git, and neither reaches the agent's environment. GITHUB_API_URL
// overrides the API base URL. `--once` runs a single attempt and exits,
// `--now` ignores the window, and `--issue KEY` names the issue instead of
// searching for one; together they are the dry run.

import { access, constants, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { Git, type ConfigEntry } from "@glizzus/git";
import { GitHubClient, cloneUrl, parseRepository } from "@glizzus/github";
import { type Issue, JiraClient } from "@glizzus/jira";
import { z } from "zod";

import { loadConfig } from "./config.js";
import { cloneDir } from "./layout.js";
import { type Step, nextStep, sleepMs } from "./loop.js";
import { GIT_IDENTITY, instructionFiles, runOpencode } from "./opencode.js";
import { branchFromHook, branchHookPath } from "./hooks.js";
import { type AttemptContext, type Deps, attempt } from "./run.js";
import { buildJql, handledKeys, selectNext } from "./select.js";
import { readState } from "./state.js";
import { type Window, localDate } from "./window.js";

const usage = "usage: jira-ai-implementer <config.json> [dir] [--once] [--now] [--issue KEY]\n";

/**
 * The fields every attempt needs: what the ticket says, who is on it, what it is linked to, and
 * the discussion, because a ticket's real requirements are often in its comments.
 */
const ISSUE_FIELDS = [
  "summary",
  "description",
  "labels",
  "priority",
  "status",
  "issuetype",
  "created",
  "reporter",
  "assignee",
  "comment",
  "issuelinks",
  "subtasks",
  "parent",
];

function log(message: string): void {
  process.stderr.write(`${new Date().toISOString()} ${message}\n`);
}

function die(message: string, code: 1 | 2): never {
  process.stderr.write(`jira-ai-implementer: ${message}\n${code === 2 ? usage : ""}`);
  process.exit(code);
}

const options = {
  once: { type: "boolean", default: false },
  now: { type: "boolean", default: false },
  issue: { type: "string" },
} as const;

let args: ReturnType<typeof parseArgs<{ options: typeof options; allowPositionals: true }>>;
try {
  args = parseArgs({ options, allowPositionals: true });
} catch (error) {
  die((error as Error).message, 2);
}

const [configArg, dirArg] = args.positionals;
if (!configArg || args.positionals.length > 2) {
  process.stderr.write(usage);
  process.exit(2);
}
const flags = args.values;
// The synthetic window `--now` builds never closes, so without `--once` the loop would open a
// second pull request the moment the first one landed. The two flags are one dry run together.
if (flags.now && !flags.once) die("--now requires --once", 2);

const config = await loadConfig(configArg).catch((error: unknown) => {
  if (error instanceof z.ZodError) {
    process.stderr.write(`jira-ai-implementer: ${configArg} is not a valid configuration\n`);
    process.stderr.write(`${z.prettifyError(error)}\n`);
    process.exit(2);
  }
  return die((error as Error).message, 2);
});

const jiraToken = process.env["JIRA_TOKEN"];
if (!jiraToken) die("JIRA_TOKEN is not set", 1);
const ghToken = process.env["GH_TOKEN"];
if (!ghToken) die("GH_TOKEN is not set", 1);

const apiBaseUrl = process.env["GITHUB_API_URL"];
const jira = new JiraClient(config.jira.baseUrl, jiraToken);
const github = new GitHubClient(ghToken, apiBaseUrl ? { baseUrl: apiBaseUrl } : {});

const root = path.resolve(dirArg ?? parseRepository(config.repo.github).name);

// Git reads the token from GH_TOKEN through a helper of our own, so it never
// appears in argv or in any config file. The empty entry first drops any
// helper from the user's config, which might otherwise answer with other
// credentials for the same host. The identity is the same one the agent commits
// under, so the history reads the same whoever made the commit.
const gitConfig: readonly ConfigEntry[] = [
  ["credential.helper", ""],
  ["credential.helper", '!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f'],
  ["user.name", GIT_IDENTITY.name],
  ["user.email", GIT_IDENTITY.email],
];

async function openClone(): Promise<Git> {
  const dir = cloneDir(root);
  try {
    await access(dir);
    return new Git(dir, { config: gitConfig });
  } catch {
    const url = cloneUrl(config.repo.github, apiBaseUrl);
    log(`cloning ${url} into ${dir}`);
    await mkdir(root, { recursive: true });
    return Git.clone(url, dir, { bare: true, config: gitConfig });
  }
}

// Branches come only from the operator's hook, so a daemon without one has nothing to do tonight
// and should say so now rather than at 02:00.
try {
  await access(branchHookPath(root), constants.X_OK);
} catch {
  die(`${branchHookPath(root)} is missing or not executable; it must print the branch to work on`, 2);
}

const git = await openClone();
// A worktree whose directory was removed by hand, or by a cleanup that did not
// tell git, would otherwise make `worktree add` refuse the path. What is left
// after that is a tree from a crashed run: the work in it is gone with the
// process, so it goes too rather than being inherited by tonight's attempt.
await git.worktreePrune();
for (const worktree of await git.worktreeList()) {
  if (worktree.path === cloneDir(root) || !worktree.path.startsWith(root + path.sep)) continue;
  log(`removing the leftover worktree ${worktree.path}`);
  await git.worktreeRemove(worktree.path, { force: true });
}

const instructions = await instructionFiles();
log(`instructions: ${instructions.join(", ")}`);

const deps: Deps = { git, github, branchHook: branchFromHook, opencode: runOpencode, now: () => new Date(), log };

const state = await readState(root);

function context(night: string): AttemptContext {
  return { config, root, night, state, instructions };
}

/** What one poll came to. */
type Outcome = "pr" | "failed" | "nothing";

/**
 * Finds the night's issue and attempts it. JQL expresses the whole rule -- the project, the label,
 * not done -- in Jira's own priority order, so the issues already handled are all that has to be
 * taken out here: the ones with a pull request on GitHub, and the ones that failed. The chosen key
 * is then fetched in full, because a search response is a cheaper, thinner thing than an issue.
 */
async function poll(window: Window): Promise<Outcome> {
  let issue: Issue | undefined;
  if (flags.issue) {
    issue = await jira.getIssue(flags.issue, { fields: ISSUE_FIELDS });
  } else {
    const found = await jira.search(buildJql(config.jira), { fields: ["summary"], maxResults: 50 });
    const pulls = await github.listPullRequests(config.repo.github, { state: "all" });
    const keys = found.issues.map((candidate) => candidate.key);
    const key = selectNext(keys, handledKeys(keys, pulls, state.failed));
    if (key) issue = await jira.getIssue(key, { fields: ISSUE_FIELDS });
  }
  if (!issue) {
    log(`nothing left to do among the ${config.jira.label} issues`);
    return "nothing";
  }
  return (await attempt(deps, context(window.night), issue)).outcome;
}

log(`watching ${config.jira.project} for ${config.jira.label}; working under ${root}`);
log(
  `window ${config.window.start}-${config.window.end} ${config.window.timezone}, ` +
    `opening draft pull requests on ${config.repo.github}`,
);

let foundNothing = false;
for (;;) {
  const now = new Date();
  // `--now` is the dry run: a window that starts this instant and lasts as long as one attempt may,
  // so the loop behaves exactly as it does at 02:00 without anyone having to wait for 02:00.
  const step: Step = flags.now
    ? {
        kind: "poll",
        window: {
          night: localDate(now, config.window.timezone),
          start: now,
          end: new Date(now.getTime() + config.opencode.timeoutMinutes * 60_000),
        },
      }
    : nextStep(now, state, config.window, foundNothing);

  if (step.kind === "sleep") {
    if (flags.once) {
      log(`nothing to do (${step.why})`);
      process.exit(1);
    }
    log(`sleeping until ${step.until.toISOString()} (${step.why})`);
    await new Promise((resolve) => setTimeout(resolve, sleepMs(now, step.until)));
    // The world may have moved while asleep, so nothing is assumed about it on waking.
    foundNothing = false;
    continue;
  }

  let outcome: Outcome;
  try {
    outcome = await poll(step.window);
  } catch (error) {
    // A Jira or a GitHub that is down is not a failed attempt: no issue was worked on, so this
    // night is still open, and the loop waits a poll interval like any other empty poll.
    log(`poll failed: ${(error as Error).message}`);
    outcome = "nothing";
  }

  if (flags.once) process.exit(outcome === "pr" ? 0 : 1);
  // A pull request sets `lastPrNight`, so the next step sleeps the night out. A failed attempt
  // loops straight back round to the next ticket.
  foundNothing = outcome === "nothing";
}
