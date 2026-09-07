#!/usr/bin/env node
// Polls a GitHub repository every five minutes and keeps one detached git
// worktree per open pull request under a root directory, each with a port of
// its own. If the repository ships `.pr-preview/up`, it runs in the worktree
// after it is created or moved to a new head; `.pr-preview/down` runs before
// the worktree is removed.
//
//   pr-preview <owner/name> [--checkout <dir>] [--root <dir>] [--allow-forks]
//
// GH_TOKEN must be set. GITHUB_API_URL overrides the API base URL.

import path from "node:path";
import { parseArgs } from "node:util";

import { Git } from "@glizzus/git";
import { GitHubClient, isFromFork } from "@glizzus/github";

import { plan } from "./plan.js";
import { allocatePort, apply, existingPreviews, previewDir, runHook } from "./preview.js";
import { readState, writeState } from "./state.js";

const INTERVAL_MS = 5 * 60 * 1000;

const usage = "usage: pr-preview <owner/name> [--checkout <dir>] [--root <dir>] [--allow-forks]\n";

const options = {
  checkout: { type: "string", default: "." },
  root: { type: "string", default: ".pr-preview" },
  "allow-forks": { type: "boolean", default: false },
} as const;

let args: ReturnType<typeof parseArgs<{ options: typeof options; allowPositionals: true }>>;
try {
  args = parseArgs({ options, allowPositionals: true });
} catch (error) {
  process.stderr.write(`pr-preview: ${(error as Error).message}\n${usage}`);
  process.exit(2);
}

const repoArg = args.positionals[0];
if (!repoArg) {
  process.stderr.write(usage);
  process.exit(2);
}
const repo: string = repoArg;

const token = process.env["GH_TOKEN"];
if (!token) {
  process.stderr.write("pr-preview: GH_TOKEN is not set\n");
  process.exit(1);
}

const checkout = path.resolve(args.values.checkout);
const root = path.resolve(args.values.root);
const allowForks = args.values["allow-forks"];

const baseUrl = process.env["GITHUB_API_URL"];
const github = new GitHubClient(token, baseUrl ? { baseUrl } : {});
const git = new Git(checkout);

function log(message: string): void {
  process.stderr.write(`${new Date().toISOString()} ${message}\n`);
}

async function poll(): Promise<void> {
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
          const code = await runHook("down", dir, { PR_NUMBER: key, PR_SHA: previous.sha, PORT: String(previous.port) });
          if (code !== undefined && code !== 0) log(`down hook for pr-${key} exited ${String(code)}`);
        }
        await apply(git, root, action);
        delete state[key];
      } else {
        await apply(git, root, action);
        const port = state[key]?.port ?? allocatePort(state);
        state[key] = { sha: action.sha, port };
        const pr = byNumber.get(action.number);
        const code = await runHook("up", dir, {
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

log(`watching ${repo}; checkout ${checkout}; previews under ${root}`);
for (;;) {
  try {
    await poll();
  } catch (error) {
    log(`poll failed: ${(error as Error).message}`);
  }
  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
}
