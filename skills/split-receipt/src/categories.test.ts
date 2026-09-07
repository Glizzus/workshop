import { describe, expect, it } from "vitest";

import type { CategoriesData, Category, CategoryGroupWithCategories } from "@glizzus/ynab";

import { renderCategories } from "./categories.js";

function category(overrides: Partial<Category> & Pick<Category, "id" | "name">): Category {
  return {
    category_group_id: "grp",
    hidden: false,
    internal: false,
    budgeted: 0,
    activity: 0,
    balance: 0,
    deleted: false,
    ...overrides,
  };
}

function group(
  overrides: Partial<CategoryGroupWithCategories> & Pick<CategoryGroupWithCategories, "id" | "name">,
): CategoryGroupWithCategories {
  return { hidden: false, internal: false, deleted: false, categories: [], ...overrides };
}

describe("renderCategories", () => {
  it("renders one heading per group and one bullet per category", () => {
    const data: CategoriesData = {
      server_knowledge: 1,
      category_groups: [
        group({
          id: "g1",
          name: "Everyday",
          categories: [
            category({ id: "c1", name: "Groceries" }),
            category({ id: "c2", name: "Alcohol" }),
          ],
        }),
        group({ id: "g2", name: "Home", categories: [category({ id: "c3", name: "Household" })] }),
      ],
    };

    expect(renderCategories(data)).toBe(
      [
        "# Categories",
        "",
        "## Everyday",
        "",
        "- Groceries (`c1`)",
        "- Alcohol (`c2`)",
        "",
        "## Home",
        "",
        "- Household (`c3`)",
        "",
      ].join("\n"),
    );
  });

  it.each([
    { flag: "hidden" as const },
    { flag: "internal" as const },
    { flag: "deleted" as const },
  ])("omits $flag categories and groups", ({ flag }) => {
    const data: CategoriesData = {
      server_knowledge: 1,
      category_groups: [
        group({ id: "g1", name: "Skipped", [flag]: true, categories: [category({ id: "c1", name: "X" })] }),
        group({
          id: "g2",
          name: "Kept",
          categories: [
            category({ id: "c2", name: "Shown" }),
            category({ id: "c3", name: "Skipped", [flag]: true }),
          ],
        }),
      ],
    };

    const out = renderCategories(data);

    expect(out).toContain("## Kept");
    expect(out).toContain("- Shown (`c2`)");
    expect(out).not.toContain("Skipped");
  });

  it("omits a group whose categories are all filtered out", () => {
    const data: CategoriesData = {
      server_knowledge: 1,
      category_groups: [
        group({ id: "g1", name: "Empty", categories: [category({ id: "c1", name: "X", hidden: true })] }),
      ],
    };

    expect(renderCategories(data)).toBe("# Categories\n");
  });
});
