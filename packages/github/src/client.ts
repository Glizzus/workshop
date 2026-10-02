import { GITHUB_API_BASE_URL, GITHUB_API_VERSION } from "./constants.js";
import { parseRepository } from "./logic.js";
import type { CreatePullRequestBody, ErrorDetail, PullRequest } from "./types.js";

/** Options for {@link GitHubClient.listPullRequests}. */
export interface ListPullRequestsOptions {
  /** Defaults to open. */
  state?: "open" | "closed" | "all";
}

/** Thrown when GitHub answers with a non-2xx status. */
export class GitHubError extends Error {
  /** HTTP status of the failed response. */
  readonly status: number;
  /** GitHub's error body, when the response carried one. */
  readonly detail: ErrorDetail | undefined;

  constructor(status: number, detail: ErrorDetail | undefined) {
    super(detail ? `GitHub ${String(status)}: ${detail.message}` : `GitHub ${String(status)}`);
    this.name = "GitHubError";
    this.status = status;
    this.detail = detail;
  }
}

/** Options for {@link GitHubClient}. */
export interface GitHubClientOptions {
  /**
   * Base URL of the REST API, without a trailing slash. Defaults to
   * github.com's; a GitHub Enterprise Server instance is
   * `https://<host>/api/v3`.
   */
  baseUrl?: string;
}

/** A thin client for the GitHub REST API, authenticated with a token. */
export class GitHubClient {
  readonly #token: string;
  readonly #baseUrl: string;

  constructor(token: string, options: GitHubClientOptions = {}) {
    this.#token = token;
    this.#baseUrl = (options.baseUrl ?? GITHUB_API_BASE_URL).replace(/\/+$/, "");
  }

  /**
   * GET /repos/{owner}/{repo}/pulls. Returns the repository's pull requests,
   * most recently created first. `repo` is `owner/name`.
   *
   * Reads a single page of 100. A repository with more open pull requests
   * than that is not a case this package handles yet.
   */
  async listPullRequests(repo: string, options: ListPullRequestsOptions = {}): Promise<PullRequest[]> {
    const url = new URL(`${this.#baseUrl}/repos/${repoPath(repo)}/pulls`);
    url.searchParams.set("state", options.state ?? "open");
    url.searchParams.set("per_page", "100");
    return this.#request<PullRequest[]>("GET", url);
  }

  /**
   * POST /repos/{owner}/{repo}/pulls. Opens a pull request and returns it.
   * `repo` is `owner/name`.
   *
   * Pass `draft: true` for a draft pull request. GitHub's REST API cannot
   * flip that flag afterwards, so it is decided here or not at all.
   */
  async createPullRequest(repo: string, body: CreatePullRequestBody): Promise<PullRequest> {
    const url = new URL(`${this.#baseUrl}/repos/${repoPath(repo)}/pulls`);
    return this.#request<PullRequest>("POST", url, body);
  }

  /** Sends `body` as JSON when given one; a request without a body sends no `Content-Type`. */
  async #request<T>(method: "GET" | "POST", url: URL, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      // GitHub rejects requests without one.
      "User-Agent": "glizzus-workshop",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      let detail: ErrorDetail | undefined;
      try {
        detail = (await response.json()) as ErrorDetail;
      } catch {
        detail = undefined;
      }
      throw new GitHubError(response.status, detail);
    }
    return (await response.json()) as T;
  }
}

/** `owner/name` as the two path segments the API wants, each encoded. */
function repoPath(repo: string): string {
  const { owner, name } = parseRepository(repo);
  return `${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}
