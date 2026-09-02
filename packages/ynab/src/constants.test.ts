import { describe, expect, it } from "vitest";

import { YNAB_API_BASE_URL } from "./constants.js";

describe("YNAB_API_BASE_URL", () => {
  it("points at v1 of the API with no trailing slash", () => {
    expect(YNAB_API_BASE_URL).toBe("https://api.ynab.com/v1");
  });
});
