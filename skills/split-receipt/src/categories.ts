import type { CategoriesData } from "@glizzus/ynab";

/**
 * Renders a plan's categories as the markdown SKILL.md expects in
 * `categories.md`: one heading per group, one bullet per category with its id.
 * Hidden, internal, and deleted groups and categories are left out -- a receipt
 * should never be split into one of those.
 */
export function renderCategories(data: CategoriesData): string {
  const lines: string[] = ["# Categories", ""];

  for (const group of data.category_groups) {
    if (group.hidden || group.internal || group.deleted) continue;

    const categories = group.categories.filter((c) => !c.hidden && !c.internal && !c.deleted);
    if (categories.length === 0) continue;

    lines.push(`## ${group.name}`, "");
    for (const category of categories) {
      lines.push(`- ${category.name} (\`${category.id}\`)`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
