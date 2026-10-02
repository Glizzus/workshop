import { afterEach, describe, expect, it, vi } from "vitest";

import { GitHubClient, GitHubError } from "./client.js";

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const stub = vi.fn(() =>
    Promise.resolve(
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  vi.stubGlobal("fetch", stub);
  return stub;
}

function requested(stub: ReturnType<typeof vi.fn>): { url: URL; init: RequestInit } {
  const [url, init] = stub.mock.calls[0] as [URL, RequestInit];
  return { url, init };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHubClient.listPullRequests", () => {
  it("requests open pulls for the repository with auth and version headers", async () => {
    const stub = stubFetch(200, [{ number: 7 }]);
    const prs = await new GitHubClient("tok").listPullRequests("octo/repo");

    expect(prs).toEqual([{ number: 7 }]);
    const { url, init } = requested(stub);
    expect(url.toString()).toBe("https://api.github.com/repos/octo/repo/pulls?state=open&per_page=100");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer tok");
    expect(headers["Accept"]).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(headers["User-Agent"]).toBeTruthy();
    // A bodyless request declares no content type.
    expect(headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("uses a configured base URL, tolerating a trailing slash", async () => {
    const stub = stubFetch(200, []);
    await new GitHubClient("tok", { baseUrl: "https://ghe.example.com/api/v3/" }).listPullRequests("octo/repo");
    expect(requested(stub).url.toString()).toBe(
      "https://ghe.example.com/api/v3/repos/octo/repo/pulls?state=open&per_page=100",
    );
  });

  it("passes the state option through", async () => {
    const stub = stubFetch(200, []);
    await new GitHubClient("tok").listPullRequests("octo/repo", { state: "all" });
    expect(requested(stub).url.searchParams.get("state")).toBe("all");
  });

  it("rejects a repository that is not owner/name", async () => {
    stubFetch(200, []);
    await expect(new GitHubClient("tok").listPullRequests("octo")).rejects.toThrow(/owner\/name/);
  });

  it("throws GitHubError carrying the status and GitHub's message", async () => {
    stubFetch(401, { message: "Bad credentials" });
    const error = await new GitHubClient("tok").listPullRequests("octo/repo").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitHubError);
    expect((error as GitHubError).status).toBe(401);
    expect((error as GitHubError).message).toBe("GitHub 401: Bad credentials");
  });

  it("survives an error response without a JSON body", async () => {
    stubFetch(502, "bad gateway");
    const error = await new GitHubClient("tok").listPullRequests("octo/repo").catch((e: unknown) => e);
    expect((error as GitHubError).detail).toBeUndefined();
  });
});

describe("GitHubClient.createPullRequest", () => {
  it("posts the pull request and returns the one GitHub answers with", async () => {
    const created = { number: 12, draft: true };
    const stub = stubFetch(201, created);
    const body = { title: "Fix it", head: "fix", base: "main", body: "why", draft: true };
    const pr = await new GitHubClient("tok").createPullRequest("octo/repo", body);

    expect(pr).toEqual(created);
    const { url, init } = requested(stub);
    expect(init.method).toBe("POST");
    expect(url.toString()).toBe("https://api.github.com/repos/octo/repo/pulls");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer tok");
    expect(headers["Accept"]).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(headers["User-Agent"]).toBeTruthy();
    expect(headers["Content-Type"]).toBe("application/json");
    // draft travels on the wire, or the pull request opens ready for review.
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it("throws GitHubError carrying the status of a rejected creation", async () => {
    stubFetch(422, { message: "Validation Failed" });
    const error = await new GitHubClient("tok")
      .createPullRequest("octo/repo", { title: "t", head: "fix", base: "main" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitHubError);
    expect((error as GitHubError).status).toBe(422);
  });
});
