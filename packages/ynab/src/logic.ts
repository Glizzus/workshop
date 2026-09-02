import type { TransactionDetail } from "./types.js";

// Amounts are decimal strings, not numbers, on purpose. YNAB stores amounts as
// integer milliunits, and a receipt total is text lifted off the receipt. A
// JS number in between would round: 94.02 * 1000 is 94020.00000000001. Parsing
// the string straight to milliunits keeps the comparison exact.

/**
 * Parses a currency amount as printed on a receipt ("94.02", "$1,234.5") into
 * YNAB milliunits (94020, 1234500). Accepts an optional leading "$", thousands
 * commas, and up to three decimal places. Throws a RangeError on anything
 * else, including negative amounts.
 */
export function parseMilliunits(amount: string): number {
  const match = /^\$?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,3}))?$/.exec(amount.trim());
  if (!match) {
    throw new RangeError(`not a currency amount: ${JSON.stringify(amount)}`);
  }
  const [, whole = "", fraction = ""] = match;
  return Number(whole.replaceAll(",", "")) * 1000 + Number(fraction.padEnd(3, "0"));
}

/**
 * Returns the outflow transactions whose amount equals `total`, in the order
 * given. `total` is a receipt total as printed, e.g. "94.02"; see
 * {@link parseMilliunits} for the accepted forms.
 *
 * Only outflows match: a receipt is a purchase, and a refund for the same
 * amount is a different transaction. Deleted transactions never match. Several
 * transactions can share a total, so the caller decides how to break ties --
 * usually by date.
 */
export function findTransactionsByTotal(
  transactions: readonly TransactionDetail[],
  total: string,
): TransactionDetail[] {
  const outflow = -parseMilliunits(total);
  return transactions.filter((t) => !t.deleted && t.amount === outflow);
}
