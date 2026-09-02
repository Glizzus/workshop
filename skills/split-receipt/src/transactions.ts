import type { TransactionDetail } from "@ynab-engine/ynab";

/**
 * Renders the transactions that matched a receipt total as markdown, newest
 * first, one bullet per transaction with the details needed to tell them apart
 * and the id needed to update the right one. Anything that would make the
 * transaction a poor target for a split -- already split, a transfer -- is
 * flagged on a nested bullet so the caller does not have to know YNAB's rules.
 *
 * `total` is echoed in the heading as the caller typed it.
 */
export function renderTransactions(
  transactions: readonly TransactionDetail[],
  total: string,
): string {
  const lines: string[] = [`# Transactions for ${total.trim()}`, ""];

  if (transactions.length === 0) {
    lines.push("- None", "");
    return lines.join("\n");
  }

  // Newest first; a receipt is usually matched soon after the purchase. The
  // sort is stable, so transactions on the same day keep the API's order.
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  for (const t of sorted) {
    const payee = t.payee_name ?? "(no payee)";
    const category = t.category_name ?? "(uncategorized)";
    lines.push(`- **${t.date}** ${payee} — ${t.account_name} → ${category} (\`${t.id}\`)`);
    lines.push(`  - ${t.cleared}, ${t.approved ? "approved" : "unapproved"}`);
    if (t.memo) {
      lines.push(`  - memo: ${t.memo}`);
    }
    if (t.subtransactions.length > 0) {
      lines.push(
        `  - ⚠️ already split into ${String(t.subtransactions.length)} subtransactions; YNAB cannot change an existing split`,
      );
    }
    if (t.transfer_account_id) {
      lines.push("  - ⚠️ transfer between accounts, not a purchase");
    }
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * The ISO date three calendar months before `date`, in local time, for use as
 * a `since_date`. When the target month is shorter (May 31 -> February), the
 * day is clamped to that month's last day rather than rolling into the next
 * one, so the window never shrinks by accident.
 */
export function threeMonthsBefore(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() - 3;
  // Day 0 of the following month is the last day of the target month.
  const lastDay = new Date(year, month + 1, 0).getDate();
  const target = new Date(year, month, Math.min(date.getDate(), lastDay));
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${String(target.getFullYear())}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
}
