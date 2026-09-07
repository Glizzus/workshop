import { GITHUB_API_BASE_URL } from "./constants.js";
import type { PullRequest } from "./types.js";

/** A repository named the way GitHub does: `owner/name`. */
export interface Repository {
  owner: string;
  name: string;
}

/** Splits `owner/name`, rejecting anything with more or fewer segments. */
export function parseRepository(repo: string): Repository {
  const parts = repo.split("/");
  const [owner, name] = parts;
  if (parts.length !== 2 || !owner || !name) {
    throw new Error(`repository must be owner/name, got ${JSON.stringify(repo)}`);
  }
  return { owner, name };
}

/**
 * The HTTPS URL to clone a repository from, given the API base URL the
 * client talks to. github.com's API lives on its own host, `api.github.com`,
 * while GitHub Enterprise Server serves it from `/api/v3` on the web host;
 * both derive the git host from the API URL.
 */
export function cloneUrl(repo: string, apiBaseUrl: string = GITHUB_API_BASE_URL): string {
  const { owner, name } = parseRepository(repo);
  const api = new URL(apiBaseUrl);
  const host = api.origin === new URL(GITHUB_API_BASE_URL).origin ? "https://github.com" : api.origin;
  return `${host}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}.git`;
}


/**
 * The git refspec under which GitHub publishes a pull request's head commit.
 * Fetching it from the base repository's remote leaves the commit in
 * FETCH_HEAD, whether or not the branch lives in a fork. A GitHub convention,
 * which is why it lives here and not in the git package.
 */
export function pullRequestHeadRef(number: number): string {
  return `pull/${String(number)}/head`;
}

/**
 * Whether the pull request's branch lives in a different repository from
 * the one it targets: a fork, or a fork that has since been deleted. Code
 * from a fork was pushed by someone without write access to the base.
 */
export function isFromFork(pr: PullRequest): boolean {
  return pr.head.repo === null || pr.head.repo.full_name !== pr.base.repo.full_name;
}
