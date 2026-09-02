import { afterEach, describe, expect, it, vi } from "vitest";

import { YNABClient, YNABError } from "./client.js";
import type {
  CategoriesResponse,
  TransactionDetail,
  TransactionResponse,
  TransactionsResponse,
} from "./types.js";

const TOKEN = "test-token";

const EMPTY_RESPONSE: TransactionsResponse = {
  data: { transactions: [], server_knowledge: 42 },
};

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

function requestedInit(stub: ReturnType<typeof vi.fn>): RequestInit {
  const [, init] = stub.mock.calls[0] as [URL, RequestInit];
  return init;
}

function requestedUrl(stub: ReturnType<typeof vi.fn>): URL {
  const [input] = stub.mock.calls[0] as [URL, RequestInit];
  return input;
}

function requestedHeaders(stub: ReturnType<typeof vi.fn>): Record<string, string> {
  return requestedInit(stub).headers as Record<string, string>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("YNABClient.getTransactions", () => {
  it("hits GET /plans/{plan_id}/transactions with a bearer token", async () => {
    const stub = stubFetch(200, EMPTY_RESPONSE);

    await new YNABClient(TOKEN).getTransactions("last-used");

    expect(stub).toHaveBeenCalledTimes(1);
    expect(requestedUrl(stub).toString()).toBe(
      "https://api.ynab.com/v1/plans/last-used/transactions",
    );
    expect(requestedHeaders(stub)).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it("returns the data member of the response", async () => {
    stubFetch(200, EMPTY_RESPONSE);

    await expect(new YNABClient(TOKEN).getTransactions("last-used")).resolves.toEqual(
      EMPTY_RESPONSE.data,
    );
  });

  it.each([
    { since_date: undefined, expected: "" },
    { since_date: "2016-12-30", expected: "?since_date=2016-12-30" },
  ])("since_date $since_date -> query $expected", async ({ since_date, expected }) => {
    const stub = stubFetch(200, EMPTY_RESPONSE);

    await new YNABClient(TOKEN).getTransactions("last-used", { since_date });

    expect(requestedUrl(stub).search).toBe(expected);
  });

  it("escapes the plan id", async () => {
    const stub = stubFetch(200, EMPTY_RESPONSE);

    await new YNABClient(TOKEN).getTransactions("a/b");

    expect(requestedUrl(stub).pathname).toBe("/v1/plans/a%2Fb/transactions");
  });

  it.each([
    {
      name: "JSON error body",
      status: 404,
      body: { error: { id: "404.2", name: "resource_not_found", detail: "Plan not found" } },
      detail: { id: "404.2", name: "resource_not_found", detail: "Plan not found" },
      message: "YNAB 404 resource_not_found: Plan not found",
    },
    {
      name: "non-JSON error body",
      status: 502,
      body: "<html>Bad Gateway</html>",
      detail: undefined,
      message: "YNAB 502",
    },
  ])("throws YNABError on $name", async ({ status, body, detail, message }) => {
    stubFetch(status, body);

    const promise = new YNABClient(TOKEN).getTransactions("last-used");

    await expect(promise).rejects.toBeInstanceOf(YNABError);
    await expect(promise).rejects.toMatchObject({ status, detail, message });
  });
});

const TRANSACTION: TransactionDetail = {
  id: "txn-1",
  date: "2016-12-01",
  amount: -50000,
  cleared: "cleared",
  approved: true,
  account_id: "acct-1",
  account_name: "Checking",
  deleted: false,
  subtransactions: [],
};

const TRANSACTION_RESPONSE: TransactionResponse = {
  data: { transaction: TRANSACTION, server_knowledge: 43 },
};

describe("YNABClient.updateTransaction", () => {
  it("PUTs to /plans/{plan_id}/transactions/{transaction_id} as JSON", async () => {
    const stub = stubFetch(200, TRANSACTION_RESPONSE);

    await new YNABClient(TOKEN).updateTransaction("last-used", "txn/1", { memo: "hi" });

    expect(stub).toHaveBeenCalledTimes(1);
    expect(requestedUrl(stub).toString()).toBe(
      "https://api.ynab.com/v1/plans/last-used/transactions/txn%2F1",
    );
    expect(requestedInit(stub).method).toBe("PUT");
    expect(requestedHeaders(stub)).toMatchObject({
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    });
  });

  it("wraps the transaction in the request body", async () => {
    const stub = stubFetch(200, TRANSACTION_RESPONSE);
    const transaction = {
      category_id: null,
      subtransactions: [
        { amount: -30000, category_id: "cat-groceries" },
        { amount: -20000, category_id: "cat-household", memo: "paper towels" },
      ],
    };

    await new YNABClient(TOKEN).updateTransaction("last-used", "txn-1", transaction);

    expect(JSON.parse(requestedInit(stub).body as string)).toEqual({ transaction });
  });

  it("returns the data member of the response", async () => {
    stubFetch(200, TRANSACTION_RESPONSE);

    await expect(
      new YNABClient(TOKEN).updateTransaction("last-used", "txn-1", { memo: "hi" }),
    ).resolves.toEqual(TRANSACTION_RESPONSE.data);
  });

  it("throws YNABError on a validation error", async () => {
    stubFetch(400, {
      error: { id: "400", name: "bad_request", detail: "subtransactions cannot be updated" },
    });

    await expect(
      new YNABClient(TOKEN).updateTransaction("last-used", "txn-1", { subtransactions: [] }),
    ).rejects.toMatchObject({
      status: 400,
      message: "YNAB 400 bad_request: subtransactions cannot be updated",
    });
  });
});

const CATEGORIES_RESPONSE: CategoriesResponse = {
  data: {
    category_groups: [
      {
        id: "grp-1",
        name: "Everyday",
        hidden: false,
        internal: false,
        deleted: false,
        categories: [
          {
            id: "cat-groceries",
            category_group_id: "grp-1",
            name: "Groceries",
            hidden: false,
            internal: false,
            budgeted: 400000,
            activity: -94020,
            balance: 305980,
            deleted: false,
          },
        ],
      },
    ],
    server_knowledge: 44,
  },
};

describe("YNABClient.getCategories", () => {
  it("hits GET /plans/{plan_id}/categories with a bearer token", async () => {
    const stub = stubFetch(200, CATEGORIES_RESPONSE);

    await new YNABClient(TOKEN).getCategories("last-used");

    expect(stub).toHaveBeenCalledTimes(1);
    expect(requestedUrl(stub).toString()).toBe(
      "https://api.ynab.com/v1/plans/last-used/categories",
    );
    expect(requestedInit(stub).method).toBe("GET");
    expect(requestedHeaders(stub)).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it("escapes the plan id", async () => {
    const stub = stubFetch(200, CATEGORIES_RESPONSE);

    await new YNABClient(TOKEN).getCategories("a/b");

    expect(requestedUrl(stub).pathname).toBe("/v1/plans/a%2Fb/categories");
  });

  it("returns the data member of the response", async () => {
    stubFetch(200, CATEGORIES_RESPONSE);

    await expect(new YNABClient(TOKEN).getCategories("last-used")).resolves.toEqual(
      CATEGORIES_RESPONSE.data,
    );
  });

  it("throws YNABError when no categories are found", async () => {
    stubFetch(404, {
      error: { id: "404.2", name: "resource_not_found", detail: "Plan not found" },
    });

    await expect(new YNABClient(TOKEN).getCategories("nope")).rejects.toMatchObject({
      status: 404,
      message: "YNAB 404 resource_not_found: Plan not found",
    });
  });
});
