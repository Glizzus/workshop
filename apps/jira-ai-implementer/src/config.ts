// Everything the operator decides, in one JSON file. Validation is deliberately
// strict and happens once at startup: a daemon that only wakes at 02:00 should
// not discover at 02:00 that its time zone was misspelled.

import { readFile } from "node:fs/promises";

import { parseRepository } from "@glizzus/github";
import { z } from "zod";

const isKnownTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** A time of day on a 24-hour clock, local to the configured zone. */
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM on a 24-hour clock");

/** `owner/name`, checked with the same parser the GitHub client uses, so the message matches. */
const GitHubRepository = z.string().superRefine((value, ctx) => {
  try {
    parseRepository(value);
  } catch (error) {
    ctx.addIssue({ code: "custom", message: (error as Error).message });
  }
});

const Jira = z.object({
  baseUrl: z.url(),
  project: z.string().min(1),
  /**
   * The one label that makes an issue eligible. Jira forbids whitespace in labels, so it is
   * rejected here rather than by a search that silently matches nothing.
   */
  label: z
    .string()
    .min(1)
    .refine((value) => !/\s/.test(value), "must not contain whitespace")
    .default("auto-ai-implement"),
});

const Repo = z.object({
  github: GitHubRepository,
  baseBranch: z.string().min(1).default("main"),
});

/**
 * The nightly window. An `end` at or before `start` describes a window that crosses midnight.
 * Equal times are rejected because they would mean either nothing or a whole day, and neither is
 * what anyone writing them down intends.
 */
const Window = z
  .object({
    timezone: z.string().refine(isKnownTimeZone, "unknown IANA time zone"),
    start: Time.default("02:00"),
    end: Time.default("04:00"),
  })
  .refine((window) => window.start !== window.end, "window start and end must differ");

const OpenCode = z.object({
  /** `provider/model`, as OpenCode names them. Omitted leaves the operator's default in place. */
  model: z.string().optional(),
  timeoutMinutes: z.int().positive().default(90),
});

/** The daemon's whole configuration file. */
export const Config = z.object({
  jira: Jira,
  repo: Repo,
  window: Window,
  opencode: OpenCode.prefault({}),
});

export type Config = z.infer<typeof Config>;

/**
 * Reads and validates the configuration file. Errors -- a missing file, malformed JSON, a schema
 * violation -- propagate untouched, because `main.ts` is what knows how to present them.
 */
export async function loadConfig(path: string): Promise<Config> {
  return Config.parse(JSON.parse(await readFile(path, "utf8")));
}
