import { describe, expect, it } from "vitest";

import { UpdatePayload, toSplitTransaction } from "./update-payload.js";

const VALID = {
  transaction_id: "txn-1",
  subtransactions: [
    { category_id: "cat-groceries", memo: "Avocado oil", amount: -14640 },
    { category_id: "cat-alcohol", memo: "Beer", amount: -17940 },
  ],
};

describe("UpdatePayload", () => {
  it("accepts a valid payload", () => {
    expect(UpdatePayload.parse(VALID)).toEqual(VALID);
  });

  it("drops fields it does not know", () => {
    const withExtra = {
      ...VALID,
      extra: 1,
      subtransactions: [{ ...VALID.subtransactions[0], payee_name: "x" }],
    };

    expect(UpdatePayload.parse(withExtra)).toEqual({
      transaction_id: "txn-1",
      subtransactions: [VALID.subtransactions[0]],
    });
  });

  it.each([
    { name: "not an object", json: "nope", path: [] },
    { name: "missing transaction_id", json: { ...VALID, transaction_id: undefined }, path: ["transaction_id"] },
    { name: "empty transaction_id", json: { ...VALID, transaction_id: "" }, path: ["transaction_id"] },
    { name: "missing subtransactions", json: { transaction_id: "t" }, path: ["subtransactions"] },
    { name: "empty subtransactions", json: { ...VALID, subtransactions: [] }, path: ["subtransactions"] },
    { name: "non-object leg", json: { ...VALID, subtransactions: [1] }, path: ["subtransactions", 0] },
    {
      name: "missing category_id",
      json: { ...VALID, subtransactions: [{ memo: "m", amount: -1 }] },
      path: ["subtransactions", 0, "category_id"],
    },
    {
      name: "missing memo",
      json: { ...VALID, subtransactions: [{ category_id: "c", amount: -1 }] },
      path: ["subtransactions", 0, "memo"],
    },
    {
      name: "memo over 500 characters",
      json: { ...VALID, subtransactions: [{ category_id: "c", memo: "x".repeat(501), amount: -1 }] },
      path: ["subtransactions", 0, "memo"],
    },
    {
      name: "fractional amount",
      json: { ...VALID, subtransactions: [{ category_id: "c", memo: "m", amount: -12.99 }] },
      path: ["subtransactions", 0, "amount"],
    },
    {
      name: "string amount",
      json: { ...VALID, subtransactions: [{ category_id: "c", memo: "m", amount: "-1290" }] },
      path: ["subtransactions", 0, "amount"],
    },
  ])("rejects $name at $path", ({ json, path }) => {
    const result = UpdatePayload.safeParse(json);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(path);
  });
});

describe("toSplitTransaction", () => {
  it("nulls the parent category and passes the legs through", () => {
    expect(toSplitTransaction(UpdatePayload.parse(VALID))).toEqual({
      category_id: null,
      subtransactions: VALID.subtransactions,
    });
  });
});
