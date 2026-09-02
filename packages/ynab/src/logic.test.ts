import { describe, expect, it } from "vitest";

import { findTransactionsByTotal, parseMilliunits } from "./logic.js";
import type { TransactionDetail } from "./types.js";

describe("parseMilliunits", () => {
  it.each([
    { input: "94.02", expected: 94020 },
    { input: "$94.02", expected: 94020 },
    { input: " 94.02 ", expected: 94020 },
    { input: "94", expected: 94000 },
    { input: "94.5", expected: 94500 },
    { input: "0.005", expected: 5 },
    { input: "1,234.56", expected: 1234560 },
    { input: "$1,234,567", expected: 1234567000 },
    { input: "0", expected: 0 },
  ])("$input -> $expected", ({ input, expected }) => {
    expect(parseMilliunits(input)).toBe(expected);
  });

  it.each(["", "abc", "-94.02", "94.0201", "1,23.00", "94.", ".50", "$ 94", "94.02 USD"])(
    "rejects %j",
    (input) => {
      expect(() => parseMilliunits(input)).toThrow(RangeError);
    },
  );
});

function transaction(
  overrides: Partial<TransactionDetail> & Pick<TransactionDetail, "id" | "amount">,
): TransactionDetail {
  return {
    date: "2026-08-28",
    cleared: "cleared",
    approved: true,
    account_id: "acct",
    account_name: "Checking",
    deleted: false,
    subtransactions: [],
    ...overrides,
  };
}

describe("findTransactionsByTotal", () => {
  const walmart = transaction({ id: "walmart", amount: -94020 });
  const refund = transaction({ id: "refund", amount: 94020 });
  const deleted = transaction({ id: "deleted", amount: -94020, deleted: true });
  const other = transaction({ id: "other", amount: -94030 });
  const duplicate = transaction({ id: "duplicate", amount: -94020, date: "2026-08-29" });

  it("returns the outflow with the matching amount", () => {
    expect(findTransactionsByTotal([other, walmart], "94.02")).toEqual([walmart]);
  });

  it("returns every match, in input order", () => {
    expect(findTransactionsByTotal([duplicate, other, walmart], "94.02")).toEqual([
      duplicate,
      walmart,
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(findTransactionsByTotal([other], "94.02")).toEqual([]);
  });

  it("ignores inflows of the same amount", () => {
    expect(findTransactionsByTotal([refund], "94.02")).toEqual([]);
  });

  it("ignores deleted transactions", () => {
    expect(findTransactionsByTotal([deleted], "94.02")).toEqual([]);
  });

  it("rejects a malformed total instead of matching nothing", () => {
    expect(() => findTransactionsByTotal([walmart], "94.02 USD")).toThrow(RangeError);
  });
});
