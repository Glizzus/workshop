// The two files that pass between the daemon and the implementer: `ticket.md`
// on the way in, `pr.md` on the way out. Both are plain files in the run
// directory rather than anything shared in memory, so an attempt can be read
// after the fact -- or replayed by hand -- from what is on disk.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type Issue, renderIssue } from "@glizzus/jira";

/** What the implementer needs to know about the run, beyond the issue itself. */
export interface WriteTicketOptions {
  /** Jira site root, for the browse URL in the rendered issue. */
  baseUrl: string;
  /** `owner/name`. */
  repo: string;
  baseBranch: string;
  branch: string;
}

/** Title and body of a pull request, as the agent wrote them or as they were made up for it. */
export interface PullRequestText {
  title: string;
  body: string;
}

/** What the fallback description is built from when the agent left no `pr.md`. */
export interface PullRequestFallback {
  key: string;
  summary: string;
  /** Browsable issue URL, for the footer. */
  issueUrl: string;
}

/**
 * Writes `<runDir>/ticket.md`: a short header naming the repository and branch this attempt was
 * prepared with, then the issue as Markdown. The header is there because the agent is told to read
 * one file, and where it is and what it is working on are facts about the run, not about the issue.
 *
 * Returns the path it wrote.
 */
export async function writeTicket(runDir: string, issue: Issue, options: WriteTicketOptions): Promise<string> {
  await mkdir(runDir, { recursive: true });
  const header = [
    `- Repository: ${options.repo}`,
    `- Base branch: ${options.baseBranch}`,
    `- Branch: ${options.branch}`,
    `- Run directory: ${runDir}`,
  ].join("\n");
  const rendered = renderIssue(issue, { baseUrl: options.baseUrl });
  const file = path.join(runDir, "ticket.md");
  await writeFile(file, `${header}\n\n${rendered}`);
  return file;
}

/**
 * The prompt OpenCode is run with. Deliberately short: everything about *how* to implement a ticket
 * is in the skill, which is loaded as an instruction file, so the prompt only says which ticket,
 * where, and what to leave behind.
 */
export function prompt(options: { runDir: string; branch: string; baseBranch: string }): string {
  return (
    `Implement the Jira issue described in \`${options.runDir}/ticket.md\` in this repository ` +
    `(the current directory; branch \`${options.branch}\` created from \`${options.baseBranch}\`). ` +
    `Follow the implement-jira-issue instructions already loaded. When you are done, write the pull ` +
    `request title and body to \`${options.runDir}/pr.md\`: the first line is the title, then a blank ` +
    `line, then the body in Markdown. Do not push, do not open a pull request, and do not write ` +
    `anywhere outside this repository except \`${options.runDir}/pr.md\`.`
  );
}

/**
 * Splits a `pr.md` into title and body: the first non-empty line is the title, the rest is the
 * body. A leading `# ` is stripped, because an agent asked for a title on the first line will
 * sometimes write a Markdown heading and GitHub would show the `#` verbatim.
 *
 * `undefined` when there is no title to be had, which is what makes the caller fall back.
 */
export function parsePr(text: string): PullRequestText | undefined {
  const lines = text.split("\n");
  const index = lines.findIndex((line) => line.trim() !== "");
  if (index === -1) return undefined;
  // Only a heading marker, never a title that merely starts with a `#`, such as `#1234 fix it`.
  const title = (lines[index] ?? "").replace(/^#+(\s+|$)/, "").trim();
  if (title === "") return undefined;
  return { title, body: lines.slice(index + 1).join("\n").trim() };
}

/**
 * Reads `<runDir>/pr.md`. A missing, empty, or title-less file is not a failure: the diff is what
 * matters and it has already been pushed, so the pull request is described from the issue instead
 * and says that it was.
 *
 * The footer is appended either way, so every pull request the daemon opens links back to its
 * issue.
 */
export async function readPr(runDir: string, fallback: PullRequestFallback): Promise<PullRequestText> {
  let parsed: PullRequestText | undefined;
  try {
    parsed = parsePr(await readFile(path.join(runDir, "pr.md"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const text: PullRequestText = parsed ?? {
    title: `${fallback.key}: ${fallback.summary}`,
    body:
      "The implementer did not write a `pr.md`, so there is no description of its own. " +
      "Read the diff before merging.",
  };
  return { title: text.title, body: `${text.body}\n\n---\nJira: ${fallback.issueUrl}` };
}
