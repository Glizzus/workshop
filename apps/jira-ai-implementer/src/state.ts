// What the daemon cannot work out again by looking: which night already got its
// pull request, and which issues it has given up on. Everything else -- which
// issues are already done, what worktrees exist, what the repository contains --
// is GitHub's and git's knowledge, and is read from them.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

export const State = z.object({
  /** The night whose pull request has landed. One per night is the whole point. */
  lastPrNight: z.iso.date().optional(),
  /** Issue key -> why the last attempt failed. A key here is skipped until the operator deletes it. */
  failed: z.record(z.string(), z.object({ at: z.iso.datetime(), reason: z.string() })).prefault({}),
});

export type State = z.infer<typeof State>;

export async function readState(root: string): Promise<State> {
  try {
    return State.parse(JSON.parse(await readFile(path.join(root, "state.json"), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return State.parse({});
    throw error;
  }
}

export async function writeState(root: string, state: State): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "state.json"), JSON.stringify(state, null, 2) + "\n");
}
