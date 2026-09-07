import type { PullRequest } from "./types.js";

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
