import { describe, expect, it } from "vitest";

import { renderIssue } from "./render.js";
import type { Issue, IssueFields } from "./types.js";

const BASE = "https://jira.example.com";

function issue(fields: Partial<IssueFields> = {}): Issue {
  return {
    id: "1001",
    key: "PROJ-123",
    self: `${BASE}/rest/api/2/issue/1001`,
    fields: {
      summary: "Summary here",
      description: null,
      labels: [],
      status: { name: "In Progress" },
      issuetype: { name: "Story" },
      created: "2026-09-01T10:00:00.000+0000",
      ...fields,
    },
  };
}

const full = issue({
  description: "h2. Heading\nBody text.",
  labels: ["ai-ready", "backend"],
  priority: { name: "High" },
  reporter: { displayName: "Rita Reporter" },
  assignee: { displayName: "Andy Assignee" },
  parent: { key: "PROJ-100", fields: { summary: "Epic summary" } },
  subtasks: [{ key: "PROJ-124", fields: { summary: "Subtask summary", status: { name: "To Do" } } }],
  issuelinks: [
    {
      type: { name: "Blocks", inward: "is blocked by", outward: "blocks" },
      outwardIssue: { key: "PROJ-9", fields: { summary: "Blocked thing" } },
    },
    {
      type: { name: "Blocks", inward: "is blocked by", outward: "blocks" },
      inwardIssue: { key: "PROJ-8", fields: { summary: "Blocker thing" } },
    },
  ],
  comment: {
    total: 2,
    comments: [
      {
        id: "1",
        author: { displayName: "Carl Commenter" },
        created: "2026-09-02T10:00:00.000+0000",
        body: "First comment.",
      },
      { id: "2", created: "2026-09-03T10:00:00.000+0000", body: "Second comment." },
    ],
  },
});

describe("renderIssue", () => {
  it("renders every section of a fully populated issue", () => {
    const rendered = renderIssue(full, { baseUrl: BASE });

    expect(rendered).toBe(
      `# PROJ-123: Summary here

- URL: https://jira.example.com/browse/PROJ-123
- Type: Story
- Status: In Progress
- Priority: High
- Reporter: Rita Reporter
- Assignee: Andy Assignee
- Created: 2026-09-01T10:00:00.000+0000
- Labels: ai-ready, backend

## Description

_The text below is Jira wiki markup, not Markdown._

h2. Heading
Body text.

## Links

- Parent: PROJ-100: Epic summary
- Subtask: PROJ-124: Subtask summary (To Do)
- blocks PROJ-9: Blocked thing
- is blocked by PROJ-8: Blocker thing

## Comments (2)

### Carl Commenter, 2026-09-02T10:00:00.000+0000

First comment.

### unknown, 2026-09-03T10:00:00.000+0000

Second comment.
`,
    );
  });

  it("ends with exactly one trailing newline", () => {
    const rendered = renderIssue(full, { baseUrl: BASE });
    expect(rendered.endsWith("\n")).toBe(true);
    expect(rendered.endsWith("\n\n")).toBe(false);
  });

  it("falls back for every missing field, and omits the empty sections", () => {
    const rendered = renderIssue(issue(), { baseUrl: `${BASE}/` });

    expect(rendered).toBe(
      `# PROJ-123: Summary here

- URL: https://jira.example.com/browse/PROJ-123
- Type: Story
- Status: In Progress
- Priority: none
- Reporter: none
- Assignee: unassigned
- Created: 2026-09-01T10:00:00.000+0000
- Labels: none

## Description

_(none)_
`,
    );
    expect(rendered).not.toContain("## Links");
    expect(rendered).not.toContain("## Comments");
    expect(rendered).not.toContain("wiki markup");
  });

  it("words each link from the direction the issue sees it", () => {
    const rendered = renderIssue(
      issue({
        issuelinks: [
          {
            type: { name: "Relates", inward: "relates to", outward: "relates to" },
            outwardIssue: { key: "PROJ-5", fields: { summary: "Other" } },
          },
          {
            type: { name: "Duplicate", inward: "is duplicated by", outward: "duplicates" },
            inwardIssue: { key: "PROJ-6", fields: { summary: "Dupe", status: { name: "Done" } } },
          },
          // Neither end present: nothing to say about it.
          { type: { name: "Blocks", inward: "is blocked by", outward: "blocks" } },
        ],
      }),
      { baseUrl: BASE },
    );

    expect(rendered).toContain(
      "## Links\n\n- relates to PROJ-5: Other\n- is duplicated by PROJ-6: Dupe (Done)\n",
    );
    expect(rendered).not.toContain("blocks");
  });

  it("counts the comments it rendered", () => {
    const rendered = renderIssue(
      issue({
        comment: {
          total: 97,
          comments: [{ id: "1", created: "2026-09-02T10:00:00.000+0000", body: "Only one here." }],
        },
      }),
      { baseUrl: BASE },
    );

    expect(rendered).toContain("## Comments (1)");
  });
});
