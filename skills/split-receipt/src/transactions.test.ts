import { describe, expect, it } from "vitest";

import type { SubTransaction, TransactionDetail } from "@glizzus/ynab";

import { renderTransactions, threeMonthsBefore } from "./transactions.js";

function transaction(
  overrides: Partial<TransactionDetail> & Pick<TransactionDetail, "id">,
): TransactionDetail {
  return {
    date: "2026-08-28",
    amount: -94020,
    cleared: "cleared",
    approved: true,
    account_id: "acct",
    account_name: "Checking",
    payee_name: "Walmart",
    category_name: "Groceries",
    deleted: false,
    subtransactions: [],
    ...overrides,
  };
}

function subtransaction(id: string): SubTransaction {
  return { id, transaction_id: "t", amount: -1000, deleted: false };
}

describe("renderTransactions", () => {
  it("renders one bullet per transaction with its id", () => {
    expect(renderTransactions([transaction({ id: "t1" })], "94.02")).toBe(
      [
        "# Transactions for 94.02",
        "",
        "- **2026-08-28** Walmart — Checking → Groceries (`t1`)",
        "  - cleared, approved",
        "",
      ].join("\n"),
    );
  });

  it("renders a placeholder when nothing matched", () => {
    expect(renderTransactions([], "$94.02 ")).toBe("# Transactions for $94.02\n\n- None\n");
  });

  it("orders newest first, keeping input order within a day", () => {
    const out = renderTransactions(
      [
        transaction({ id: "old", date: "2026-08-01" }),
        transaction({ id: "new-a", date: "2026-08-28" }),
        transaction({ id: "new-b", date: "2026-08-28" }),
      ],
      "94.02",
    );

    const order = [...out.matchAll(/\(`([^`]+)`\)/g)].map((m) => m[1]);
    expect(order).toEqual(["new-a", "new-b", "old"]);
  });

  it("falls back when payee and category are missing", () => {
    const out = renderTransactions(
      [transaction({ id: "t1", payee_name: null, category_name: undefined })],
      "94.02",
    );

    expect(out).toContain("**2026-08-28** (no payee) — Checking → (uncategorized) (`t1`)");
  });

  it("shows cleared status, approval, and memo", () => {
    const out = renderTransactions(
      [transaction({ id: "t1", cleared: "uncleared", approved: false, memo: "groceries run" })],
      "94.02",
    );

    expect(out).toContain("  - uncleared, unapproved");
    expect(out).toContain("  - memo: groceries run");
  });

  it("omits an empty memo", () => {
    const out = renderTransactions([transaction({ id: "t1", memo: "" })], "94.02");

    expect(out).not.toContain("memo:");
  });

  it("flags a transaction that is already split", () => {
    const out = renderTransactions(
      [
        transaction({
          id: "t1",
          category_name: "Split",
          subtransactions: [subtransaction("s1"), subtransaction("s2")],
        }),
      ],
      "94.02",
    );

    expect(out).toContain("⚠️ already split into 2 subtransactions");
  });

  it("flags a transfer", () => {
    const out = renderTransactions(
      [transaction({ id: "t1", transfer_account_id: "savings", category_name: null })],
      "94.02",
    );

    expect(out).toContain("⚠️ transfer between accounts");
  });
});

describe("threeMonthsBefore", () => {
  it.each([
    { now: "2026-09-02", expected: "2026-06-02" },
    { now: "2026-02-15", expected: "2025-11-15", note: "crosses a year boundary" },
    { now: "2026-05-31", expected: "2026-02-28", note: "clamps to the last day of a short month" },
    { now: "2024-05-31", expected: "2024-02-29", note: "respects leap years" },
    { now: "2026-12-31", expected: "2026-09-30" },
  ])("$now -> $expected $note", ({ now, expected }) => {
    const [y = 0, m = 0, d = 0] = now.split("-").map(Number);
    expect(threeMonthsBefore(new Date(y, m - 1, d))).toBe(expected);
  });
});
