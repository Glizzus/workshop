#!/usr/bin/env node
// Prints the plan's categories as markdown, in the shape SKILL.md expects in
// categories.md. Reads the personal access token from YNAB_TOKEN; the plan id
// defaults to "last-used".
//
//   list-categories [plan-id]

import { YNABClient } from "@glizzus/ynab";

import { renderCategories } from "./categories.js";

const token = process.env["YNAB_TOKEN"];
if (!token) {
  process.stderr.write("list-categories: YNAB_TOKEN is not set\n");
  process.exit(1);
}

const planId = process.argv[2] ?? "last-used";
const data = await new YNABClient(token).getCategories(planId);
process.stdout.write(renderCategories(data));
