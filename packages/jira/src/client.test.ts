import { afterEach, describe, expect, it, vi } from "vitest";

import { JiraClient, JiraError } from "./client.js";

const BASE = "https://jira.example.com";

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

function headers(stub: ReturnType<typeof vi.fn>): Record<string, string> {
  return requested(stub).init.headers as Record<string, string>;
}

function client(): JiraClient {
  return new JiraClient(BASE, "tok");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JiraClient.search", () => {
  it("requests one page of a JQL query, defaulting maxResults to 50", async () => {
    const stub = stubFetch(200, { startAt: 0, maxResults: 50, total: 1, issues: [] });
    const page = await client().search('project = PROJ AND labels = "ai ready"');

    expect(page.total).toBe(1);
    const { url, init } = requested(stub);
    expect(init.method).toBe("GET");
    expect(url.origin + url.pathname).toBe(`${BASE}/rest/api/2/search`);
    expect(url.searchParams.get("jql")).toBe('project = PROJ AND labels = "ai ready"');
    expect(url.searchParams.get("maxResults")).toBe("50");
    expect(url.searchParams.get("fields")).toBeNull();
    expect(url.searchParams.get("expand")).toBeNull();
    // The query string is encoded, not pasted in raw.
    expect(url.search).toContain("jql=project+%3D+PROJ");
  });

  it("joins fields and expand, and passes maxResults through", async () => {
    const stub = stubFetch(200, { startAt: 0, maxResults: 5, total: 0, issues: [] });
    await client().search("project = PROJ", {
      fields: ["summary", "status", "comment"],
      maxResults: 5,
      expand: ["renderedFields", "changelog"],
    });

    const { url } = requested(stub);
    expect(url.searchParams.get("fields")).toBe("summary,status,comment");
    expect(url.searchParams.get("expand")).toBe("renderedFields,changelog");
    expect(url.searchParams.get("maxResults")).toBe("5");
  });

  it("strips trailing slashes from the base URL", async () => {
    const stub = stubFetch(200, { startAt: 0, maxResults: 50, total: 0, issues: [] });
    await new JiraClient(`${BASE}//`, "tok").search("project = PROJ");
    expect(requested(stub).url.pathname).toBe("/rest/api/2/search");
  });

  it("sends the bearer token and accepts JSON, without a content type", async () => {
    const stub = stubFetch(200, { startAt: 0, maxResults: 50, total: 0, issues: [] });
    await client().search("project = PROJ");

    expect(headers(stub)["Authorization"]).toBe("Bearer tok");
    expect(headers(stub)["Accept"]).toBe("application/json");
    expect(headers(stub)["Content-Type"]).toBeUndefined();
    expect(requested(stub).init.body).toBeUndefined();
  });
});

describe("JiraClient.getIssue", () => {
  it("encodes the key and passes fields and expand", async () => {
    const stub = stubFetch(200, { key: "PROJ-1" });
    const options = { fields: ["summary", "comment"], expand: ["renderedFields"] };
    const issue = await client().getIssue("PROJ 1", options);

    expect(issue.key).toBe("PROJ-1");
    const { url } = requested(stub);
    expect(url.pathname).toBe("/rest/api/2/issue/PROJ%201");
    expect(url.searchParams.get("fields")).toBe("summary,comment");
    expect(url.searchParams.get("expand")).toBe("renderedFields");
  });

  it("omits the optional params when no options are given", async () => {
    const stub = stubFetch(200, { key: "PROJ-1" });
    await client().getIssue("PROJ-1");
    expect(requested(stub).url.toString()).toBe(`${BASE}/rest/api/2/issue/PROJ-1`);
  });
});

describe("JiraError", () => {
  it("joins errorMessages into the message", async () => {
    stubFetch(400, { errorMessages: ["Field is required", "Nope"] });
    const error = await client().getIssue("PROJ-1").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(JiraError);
    expect((error as JiraError).name).toBe("JiraError");
    expect((error as JiraError).status).toBe(400);
    expect((error as JiraError).message).toBe("Jira 400: Field is required; Nope");
    expect((error as JiraError).detail).toEqual({ errorMessages: ["Field is required", "Nope"] });
  });

  it("renders field errors as key: value", async () => {
    stubFetch(400, { errorMessages: [], errors: { summary: "is required", labels: "unknown" } });
    const error = await client().search("project = PROJ").catch((e: unknown) => e);

    expect((error as JiraError).message).toBe("Jira 400: summary: is required; labels: unknown");
  });

  it("survives an error response without a JSON body", async () => {
    stubFetch(502, "<html>bad gateway</html>");
    const error = await client().getIssue("PROJ-1").catch((e: unknown) => e);

    expect((error as JiraError).message).toBe("Jira 502");
    expect((error as JiraError).detail).toBeUndefined();
  });
});
