# exploratory-testing

An agent skill that hunts for bugs in one feature of a running web app. It is
built to be run many times, unattended: each run tests one angle (bad input,
two tabs, small screen, ...), verifies what it finds by replaying it, and adds
it to a report. Later runs pick up where the last one stopped.

## Dependencies

- **Playwright MCP server.** Add it to your agent as an MCP server named
  `playwright` with the command `npx @playwright/mcp@latest --headless`.
  It drives Chrome by default; without Chrome, add `--browser chromium` and
  run `npx playwright install chromium` once.
- **Node.js** for `npx`.
- **The app running** at a local or test URL, with a test account.
- **git** (optional), to find the pages the branch changed.

## Install

```sh
gh skill install glizzus/skills exploratory-testing        # Copilot CLI
npx skills add glizzus/skills --skill exploratory-testing  # other agents
```

## Prompt

Run the agent from the app's repository:

```
Use the exploratory-testing skill.
Feature: Users can add a nickname on the profile page. It shows in the
header after saving. Maximum 30 characters.
App URL: http://localhost:3000
Test account: tester@example.com / hunter2
```

Optional lines: `Ticket: docs/PROJ-42.md`, `Base branch: develop`,
`Report path: findings/nickname.md`.

Be specific in the feature description. The agent only calls something a bug
when it contradicts the description or ticket.

## Use

One run tests one angle and stops. Run it in a loop until all 8 angles are done:

```sh
until grep -q '^\*\*Summary:\*\* All angles tried' findings.md 2>/dev/null; do
  <your agent's non-interactive run command> "$(cat prompt.txt)"
done
```

Then read `findings.md`. The summary line counts the bugs, each bug has steps
to reproduce it and a plain description of what went wrong, and `Notes` holds
things that looked odd but did not repeat.

To test a feature again from scratch, delete the report. Use one report per
feature. Do not run two loops on the same report at once.
