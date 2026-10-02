import { JIRA_API_PATH } from "./constants.js";
import type { ErrorDetail, Issue, SearchResponse } from "./types.js";

/** Options for {@link JiraClient.search}. */
export interface SearchOptions {
  /** Issue fields to return. Jira returns a default set when omitted. */
  fields?: string[];
  /** Defaults to 50. */
  maxResults?: number;
  /** Jira `expand` keys, such as `renderedFields`. */
  expand?: string[];
}

/** Options for {@link JiraClient.getIssue}. */
export interface GetIssueOptions {
  /** Issue fields to return. Jira returns a default set when omitted. */
  fields?: string[];
  /** Jira `expand` keys, such as `renderedFields`. */
  expand?: string[];
}

/** Thrown when Jira answers with a non-2xx status. */
export class JiraError extends Error {
  /** HTTP status of the failed response. */
  readonly status: number;
  /** Jira's error body, when the response carried one. */
  readonly detail: ErrorDetail | undefined;

  constructor(status: number, detail: ErrorDetail | undefined) {
    super(describe(status, detail));
    this.name = "JiraError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * A thin client for the Jira Server / Data Center REST API v2, authenticated
 * with a personal access token.
 */
export class JiraClient {
  readonly #baseUrl: string;
  readonly #token: string;

  /**
   * `baseUrl` is the site root, such as `https://jira.example.com`; the API
   * path is appended. A trailing slash is tolerated.
   */
  constructor(baseUrl: string, token: string) {
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#token = token;
  }

  /**
   * GET /search. Returns the issues matching a JQL query.
   *
   * Reads a single page. Paging past `maxResults` is not a case this package
   * handles yet; the response's `total` says how much was left behind.
   */
  async search(jql: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const url = this.#url("/search");
    url.searchParams.set("jql", jql);
    url.searchParams.set("maxResults", String(options.maxResults ?? 50));
    if (options.fields) {
      url.searchParams.set("fields", options.fields.join(","));
    }
    if (options.expand) {
      url.searchParams.set("expand", options.expand.join(","));
    }
    return this.#request<SearchResponse>(url);
  }

  /**
   * GET /issue/{key}. Returns one issue.
   *
   * Including `"comment"` in `fields` returns the comments inline, under
   * `fields.comment.comments`, which saves a second request.
   */
  async getIssue(key: string, options: GetIssueOptions = {}): Promise<Issue> {
    const url = this.#url(`/issue/${encodeURIComponent(key)}`);
    if (options.fields) {
      url.searchParams.set("fields", options.fields.join(","));
    }
    if (options.expand) {
      url.searchParams.set("expand", options.expand.join(","));
    }
    return this.#request<Issue>(url);
  }

  #url(path: string): URL {
    return new URL(`${this.#baseUrl}${JIRA_API_PATH}${path}`);
  }

  /** Every endpoint this package reads is a GET, so no body ever travels out. */
  async #request<T>(url: URL): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.#token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      let detail: ErrorDetail | undefined;
      try {
        detail = (await response.json()) as ErrorDetail;
      } catch {
        detail = undefined;
      }
      throw new JiraError(response.status, detail);
    }
    return (await response.json()) as T;
  }
}

/**
 * Jira reports problems two ways in the same body: `errorMessages` for the
 * request as a whole, `errors` keyed by field. Both end up in the message.
 */
function describe(status: number, detail: ErrorDetail | undefined): string {
  const parts = [
    ...(detail?.errorMessages ?? []),
    ...Object.entries(detail?.errors ?? {}).map(([field, message]) => `${field}: ${message}`),
  ];
  return parts.length === 0 ? `Jira ${String(status)}` : `Jira ${String(status)}: ${parts.join("; ")}`;
}
