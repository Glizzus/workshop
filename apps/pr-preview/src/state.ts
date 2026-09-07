// What each preview was given: the sha its worktree was last put at, and the
// port it owns for as long as it exists. Whether a worktree exists is git's
// knowledge (`git worktree list`); this file only remembers what git cannot.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

const Preview = z.object({ sha: z.string(), port: z.number().int() });
export type Preview = z.infer<typeof Preview>;

const State = z.record(z.string(), Preview);
export type State = z.infer<typeof State>;

export async function readState(root: string): Promise<State> {
  try {
    return State.parse(JSON.parse(await readFile(path.join(root, "state.json"), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export async function writeState(root: string, state: State): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "state.json"), JSON.stringify(state, null, 2) + "\n");
}
