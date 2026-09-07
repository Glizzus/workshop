#!/usr/bin/env node
// Prints the last-used plan's outflow transactions from the past three months
// whose amount equals a receipt total, as markdown, newest first. Reads the
// personal access token from YNAB_TOKEN.
//
//   find-transactions-by-total <total>
//
// `total` is the total as printed on the receipt, e.g. 94.02 or $1,234.56.

import { findTransactionsByTotal, parseMilliunits, YNABClient } from "@glizzus/ynab";

import { renderTransactions, threeMonthsBefore } from "./transactions.js";

const USAGE = "usage: find-transactions-by-total <total>\n";

function fail(message: string): never {
  process.stderr.write(`find-transactions-by-total: ${message}\n${USAGE}`);
  process.exit(1);
}

const token = process.env["YNAB_TOKEN"];
if (!token) {
  fail("YNAB_TOKEN is not set");
}

const [total, extra] = process.argv.slice(2);
if (total === undefined) {
  fail("missing <total>");
}
if (extra !== undefined) {
  fail(`unexpected argument: ${extra}`);
}

// Reject a bad total before spending a request on it.
try {
  parseMilliunits(total);
} catch (error) {
  if (error instanceof RangeError) fail(error.message);
  throw error;
}

const data = await new YNABClient(token).getTransactions("last-used", {
  since_date: threeMonthsBefore(new Date()),
});

process.stdout.write(renderTransactions(findTransactionsByTotal(data.transactions, total), total));
