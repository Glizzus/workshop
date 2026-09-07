// Field names follow the REST API's JSON so they can be looked up in
// GitHub's documentation. Only the fields this repo reads are declared;
// the responses carry many more.

/** A pull request from GET /repos/{owner}/{repo}/pulls. */
export interface PullRequest {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  draft: boolean;
  user: { login: string };
  labels: { name: string }[];
  updated_at: string;
  head: {
    /** Commit id at the tip of the pull request branch. */
    sha: string;
    ref: string;
    /** Null when the fork the branch lived in has been deleted. */
    repo: { full_name: string } | null;
  };
  base: {
    ref: string;
    repo: { full_name: string };
  };
}

/** GitHub's error body. */
export interface ErrorDetail {
  message: string;
  documentation_url?: string;
}
