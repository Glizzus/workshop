// Field names follow the REST API's JSON so they can be looked up in Jira's
// documentation. Only the fields this repo reads are declared; the responses
// carry many more.

/** A Jira user, as embedded in issues and comments. */
export interface User {
  /** The account's username. Absent on instances that hide it. */
  name?: string;
  displayName: string;
}

/** A comment on an issue. `body` is Jira wiki markup, not Markdown. */
export interface Comment {
  id: string;
  author?: User;
  created: string;
  body: string;
}

/** An issue referenced from another one: a parent, subtask, or link target. */
export interface IssueRef {
  key: string;
  fields: {
    summary: string;
    status?: { name: string };
  };
}

/**
 * A link between two issues. Exactly one of the two issue fields is present:
 * the one that is *not* the issue the link was read from.
 */
export interface IssueLink {
  /** `inward`/`outward` are the human wording, such as "blocks". */
  type: { name: string; inward: string; outward: string };
  inwardIssue?: IssueRef;
  outwardIssue?: IssueRef;
}

/** The `fields` object of an issue. */
export interface IssueFields {
  summary: string;
  description: string | null;
  labels: string[];
  priority?: { name: string } | null;
  status: { name: string };
  issuetype: { name: string };
  created: string;
  reporter?: User | null;
  assignee?: User | null;
  /** Present when `comment` was requested in `fields` or `expand`. */
  comment?: { comments: Comment[]; total: number };
  issuelinks?: IssueLink[];
  subtasks?: IssueRef[];
  parent?: IssueRef;
  /** Custom fields such as `customfield_10100`; shape depends on the instance. */
  [field: string]: unknown;
}

/** An issue from GET /issue/{key} or the search results. */
export interface Issue {
  id: string;
  key: string;
  /** API URL of the issue, not the browsable one. */
  self: string;
  fields: IssueFields;
}

/** One page of GET /search. */
export interface SearchResponse {
  startAt: number;
  maxResults: number;
  total: number;
  issues: Issue[];
}

/** Jira's error body. */
export interface ErrorDetail {
  errorMessages?: string[];
  errors?: Record<string, string>;
}
