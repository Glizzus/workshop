#!/usr/bin/env node
// Polls a GitHub repository every minute and keeps one detached git
// worktree per open pull request, each with a port of its own. Everything
// lives under one directory the daemon owns: a bare clone at `repo.git`,
// worktrees at `pr-<number>`, `state.json`, and the operator's hooks. If
// `hooks/up` exists, it runs in the worktree after it is created or moved to
// a new head; `hooks/down` runs before the worktree is removed.
//
//   pr-preview <owner/name> [dir] [--allow-forks]
//
// `dir` defaults to `./<name>`. GH_TOKEN must be set; it authenticates both
// the API and git. GITHUB_API_URL overrides the API base URL.

import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { Git, type ConfigEntry } from "@glizzus/git";
import { GitHubClient, cloneUrl, isFromFork, parseRepository } from "@glizzus/github";

import { plan } from "./plan.js";
import { allocatePort, apply, existingPreviews, previewDir, runHook } from "./preview.js";
import { readState, writeState } from "./state.js";

const INTERVAL_MS = 1 * 60 * 1000;

const usage = "usage: pr-preview <owner/name> [dir] [--allow-forks]\n";

const options = {
  "allow-forks": { type: "boolean", default: false },
} as const;

let args: ReturnType<typeof parseArgs<{ options: typeof options; allowPositionals: true }>>;
try {
  args = parseArgs({ options, allowPositionals: true });
} catch (error) {
  process.stderr.write(`pr-preview: ${(error as Error).message}\n${usage}`);
  process.exit(2);
}

const [repoArg, dirArg] = args.positionals;
if (!repoArg || args.positionals.length > 2) {
  process.stderr.write(usage);
  process.exit(2);
}
const repo: string = repoArg;
let name: string;
try {
  ({ name } = parseRepository(repo));
} catch (error) {
  process.stderr.write(`pr-preview: ${(error as Error).message}\n${usage}`);
  process.exit(2);
}

const token = process.env["GH_TOKEN"];
if (!token) {
  process.stderr.write("pr-preview: GH_TOKEN is not set\n");
  process.exit(1);
}

const root = path.resolve(dirArg ?? name);
const cloneDir = path.join(root, "repo.git");
const allowForks = args.values["allow-forks"];

const baseUrl = process.env["GITHUB_API_URL"];
const github = new GitHubClient(token, baseUrl ? { baseUrl } : {});

// Git reads the token from GH_TOKEN through a helper of our own, so it never
// appears in argv or in any config file. The empty entry first drops any
// helper from the user's config, which might otherwise answer with other
// credentials for the same host.
const gitConfig: readonly ConfigEntry[] = [
  ["credential.helper", ""],
  ["credential.helper", '!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f'],
];

function log(message: string): void {
  process.stderr.write(`${new Date().toISOString()} ${message}\n`);
}

async function openClone(): Promise<Git> {
  try {
    await access(cloneDir);
    return new Git(cloneDir, { config: gitConfig });
  } catch {
    const url = cloneUrl(repo, baseUrl);
    log(`cloning ${url} into ${cloneDir}`);
    await mkdir(root, { recursive: true });
    return Git.clone(url, cloneDir, { bare: true, config: gitConfig });
  }
}

async function poll(git: Git): Promise<void> {
  const pulls = await github.listPullRequests(repo);
  const eligible = allowForks ? pulls : pulls.filter((pr) => !isFromFork(pr));
  if (eligible.length < pulls.length) {
    log(`skipping ${String(pulls.length - eligible.length)} pull request(s) from forks`);
  }
  const byNumber = new Map(eligible.map((pr) => [pr.number, pr]));

  const state = await readState(root);
  const existing = existingPreviews(await git.worktreeList(), root, state);
  const actions = plan(
    eligible.map((pr) => ({ number: pr.number, sha: pr.head.sha })),
    existing,
  );
  if (actions.length === 0) {
    log(`${String(existing.length)} preview(s) up to date`);
    return;
  }

  for (const action of actions) {
    const key = String(action.number);
    const dir = previewDir(root, action.number);
    try {
      log(`${action.kind} pr-${key}`);
      if (action.kind === "remove") {
        const previous = state[key];
        if (previous) {
          const code = await runHook("down", root, dir, { PR_NUMBER: key, PR_SHA: previous.sha, PORT: String(previous.port) });
          if (code !== undefined && code !== 0) log(`down hook for pr-${key} exited ${String(code)}`);
        }
        await apply(git, root, action);
        delete state[key];
      } else {
        await apply(git, root, action);
        const port = state[key]?.port ?? allocatePort(state);
        state[key] = { sha: action.sha, port };
        const pr = byNumber.get(action.number);
        const code = await runHook("up", root, dir, {
          PR_NUMBER: key,
          PR_SHA: action.sha,
          PORT: String(port),
          PR_TITLE: pr?.title,
          PR_URL: pr?.html_url,
        });
        if (code !== undefined && code !== 0) log(`up hook for pr-${key} exited ${String(code)}`);
      }
    } catch (error) {
      log(`${action.kind} pr-${key} failed: ${(error as Error).message}`);
    }
    await writeState(root, state);
  }
}

log(`watching ${repo}; previews under ${root}`);
const git = await openClone();
for (;;) {
  try {
    await poll(git);
  } catch (error) {
    log(`poll failed: ${(error as Error).message}`);
  }
  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
}
