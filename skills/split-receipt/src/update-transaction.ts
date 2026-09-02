#!/usr/bin/env node
// Splits one YNAB transaction into subtransactions described by a JSON file.
// Reads the personal access token from YNAB_TOKEN.
//
//   update-transaction <payload.json>
//
// The file's shape is UpdatePayload from @ynab-engine/ynab.

import { readFile } from "node:fs/promises";

import { UpdatePayload, YNABClient, YNABError, toSplitTransaction } from "@ynab-engine/ynab";
import { z } from "zod";

const path = process.argv[2];
if (!path) {
  process.stderr.write("usage: update-transaction <payload.json>\n");
  process.exit(2);
}

const token = process.env["YNAB_TOKEN"];
if (!token) {
  process.stderr.write("update-transaction: YNAB_TOKEN is not set\n");
  process.exit(1);
}

let payload: UpdatePayload;
try {
  payload = UpdatePayload.parse(JSON.parse(await readFile(path, "utf8")));
} catch (error) {
  const message = error instanceof z.ZodError ? z.prettifyError(error) : (error as Error).message;
  process.stderr.write(`update-transaction: ${path}: ${message}\n`);
  process.exit(1);
}

try {
  const { transaction, server_knowledge } = await new YNABClient(token).updateTransaction(
    "last-used",
    payload.transaction_id,
    toSplitTransaction(payload),
  );
  process.stdout.write(JSON.stringify({ transaction, server_knowledge }, null, 2) + "\n");
} catch (error) {
  const message = error instanceof YNABError ? error.message : String(error);
  process.stderr.write(`update-transaction: ${message}\n`);
  process.exit(1);
}
