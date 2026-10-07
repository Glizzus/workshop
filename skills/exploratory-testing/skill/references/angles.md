# Angles

Read only the section for this run's angle. Use the exact values shown so the steps are easy to repeat.

## Main use

Do every normal thing the feature description says a user can do, the normal way. Use realistic values. After each one, check the result is shown correctly and is still there after you reload the page. Then check the same result on any other page that shows it.

## Changed pages

Find the pages this branch changed. Run `git diff <base>...HEAD --stat` and look at the changed files that render pages or handle routes. If there is no git, or no changed page can be found, check this angle with `skipped: <reason>`.

Open each changed page. Use its main controls once. Look for console errors, failed requests, broken layout, and missing content. These pages may not be part of the feature; a page that breaks is still a bug.

## Bad input

Try these in each input the feature adds or changes:

- Empty. Only spaces: `   `.
- At the maximum length and one character over. If no maximum is stated, try 300 characters.
- Unicode: `Zoë 😀`, Arabic `مرحبا`.
- Markup and quotes: `<b>x</b>`, `O'Brien`, `"quoted"`, `' OR 1=1 --`.
- Numbers, where a number is expected: `0`, `-1`, `1.5`, `007`, `1e5`, `1,000.50`.

Each value should be either rejected with a clear message, or saved and shown back exactly as typed. Markup must show as text, not be applied.

## Repeat and interrupt

- Click the submit or save button twice quickly.
- In a multi-step flow, use `browser_navigate_back` in the middle, then continue.
- Reload the page in the middle of a flow, then continue.
- Leave halfway through a form, then come back.
- Open a URL from the middle of a flow directly, without the earlier steps.

Look for duplicate records, lost changes, wrong values, and steps that cannot be finished.

## Empty and many

- Use the feature when nothing exists yet (no items, no history). Is the empty state clear?
- With exactly one item.
- With enough items to need a second page, or at least 25. Check the last item on the first page and the first item on the second.

Create the items you need with `run<N>` in their names.

## Change it afterwards

- After the feature has done its job, change or delete the data it depends on. For example: remove a cart item after a discount is applied, or rename a record after it was added to a list.
- Edit something the feature created, then check every page that shows it.

Totals, counts, and labels must update everywhere.

## Two tabs

Open a second tab with `browser_tabs`. Open the same record or page in both.

- Change it in one tab, then save a different change in the other.
- Delete it in one tab, then use it in the other.

The app should refuse with a clear message or show the latest data. Silently losing one of the changes is a bug.

## Small screen and keyboard

- Use `browser_resize` to 375 by 667, then do the feature's main use again. Every control must be visible and usable.
- Resize back to 1280 by 800. Do the main use again using only `browser_press_key` (Tab, Shift+Tab, Enter, Space, Escape). Every control must be reachable, and you must be able to tell which one has focus.
- In the snapshot, every new button and input must have a readable name.
