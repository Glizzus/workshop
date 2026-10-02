import type { Comment, Issue, IssueFields, IssueLink, IssueRef, User } from "./types.js";

/** Options for {@link renderIssue}. */
export interface RenderIssueOptions {
  /** Site root, such as `https://jira.example.com`, used for the browse URL. */
  baseUrl: string;
}

/**
 * The issue as Markdown, for an agent to read: the metadata it needs to decide
 * what the ticket is, then the description, the related issues, and the
 * discussion.
 *
 * Jira's own text is passed through verbatim. It is wiki markup, not Markdown,
 * so the description carries a note saying so rather than being converted.
 */
export function renderIssue(issue: Issue, options: RenderIssueOptions): string {
  const { fields } = issue;
  const sections = [
    `# ${issue.key}: ${fields.summary}`,
    metadata(issue, options.baseUrl),
    "## Description",
    description(fields),
    ...links(fields),
    ...comments(fields),
  ];
  return `${sections.join("\n\n")}\n`;
}

/** The facts a reader needs before the prose, one per line. */
function metadata(issue: Issue, baseUrl: string): string {
  const { fields } = issue;
  return [
    `- URL: ${baseUrl.replace(/\/+$/, "")}/browse/${issue.key}`,
    `- Type: ${fields.issuetype.name}`,
    `- Status: ${fields.status.name}`,
    `- Priority: ${fields.priority?.name ?? "none"}`,
    `- Reporter: ${person(fields.reporter, "none")}`,
    `- Assignee: ${person(fields.assignee, "unassigned")}`,
    `- Created: ${fields.created}`,
    `- Labels: ${fields.labels.length === 0 ? "none" : fields.labels.join(", ")}`,
  ].join("\n");
}

function person(user: User | null | undefined, fallback: string): string {
  return user?.displayName ?? fallback;
}

function description(fields: IssueFields): string {
  if (!fields.description) {
    return "_(none)_";
  }
  return `_The text below is Jira wiki markup, not Markdown._\n\n${fields.description}`;
}

/** Parent, subtasks, and issue links, when the issue has any. */
function links(fields: IssueFields): string[] {
  const lines: string[] = [];
  if (fields.parent) {
    lines.push(`- Parent: ${issueLine(fields.parent)}`);
  }
  for (const subtask of fields.subtasks ?? []) {
    lines.push(`- Subtask: ${issueLine(subtask)}`);
  }
  for (const link of fields.issuelinks ?? []) {
    const line = linkLine(link);
    if (line) {
      lines.push(line);
    }
  }
  return lines.length === 0 ? [] : ["## Links", lines.join("\n")];
}

/**
 * One link, worded the way Jira words it: a link's two directions read
 * differently ("blocks" one way, "is blocked by" the other), and only the far
 * end of the link is present on the issue that was read.
 */
function linkLine(link: IssueLink): string | undefined {
  if (link.outwardIssue) {
    return `- ${link.type.outward} ${issueLine(link.outwardIssue)}`;
  }
  if (link.inwardIssue) {
    return `- ${link.type.inward} ${issueLine(link.inwardIssue)}`;
  }
  return undefined;
}

function issueLine(ref: IssueRef): string {
  const status = ref.fields.status ? ` (${ref.fields.status.name})` : "";
  return `${ref.key}: ${ref.fields.summary}${status}`;
}

/** The discussion, oldest first, as Jira returned it. */
function comments(fields: IssueFields): string[] {
  const all: Comment[] = fields.comment?.comments ?? [];
  if (all.length === 0) {
    return [];
  }
  const sections = [`## Comments (${String(all.length)})`];
  for (const comment of all) {
    sections.push(`### ${person(comment.author, "unknown")}, ${comment.created}`, comment.body);
  }
  return sections;
}
