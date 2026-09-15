---
name: split-receipt
description: Read a receipt image, match it to a YNAB transaction, categorize each line item into the user's YNAB categories, let the user review, then split the transaction in YNAB. Use when the user provides a receipt and asks to process, categorize, or split it.
compatibility: Requires Node.js 22 or newer, network access to api.ynab.com, and a YNAB personal access token in YNAB_TOKEN.
---

# split-receipt

Read a receipt image, match it to a YNAB transaction, propose a category per line item, let the user review, fold the items into one split leg per category, then split the transaction in YNAB. Nothing is written to YNAB until step 11, and only after the user's explicit go-ahead in step 10.

Line items are scratch work; the legs YNAB receives are folded. YNAB only reports at the category level, so one leg per category gives the same budget numbers as one leg per item with far less clutter, and the receipt image remains the item-level record.

## Workflow

1. **Read the image.** Extract merchant, date/time, each line item (description as printed, price, quantity, tax flag or department code if present), subtotal, each tax line with its rate, total, and payment method.

2. **Find the YNAB transaction.** Run `./scripts/find-transactions-by-total.js <total>` with the total exactly as printed (`94.02`, `$1,234.56`). It prints every outflow from the last three months with that amount, newest first, one bullet per transaction with its id in backticks. Then:
   - Exactly one match, unflagged → use its id.
   - Several matches → show them to the user and ask which one. Do not pick by yourself.
   - `- None` → stop and tell the user. The transaction may not have imported yet, or the total was misread.
   - A match flagged ⚠️ *already split* or ⚠️ *transfer* cannot be used. YNAB refuses to change an existing split, and a transfer is not a purchase.

   Create `.tmp/receipt.json` (`mkdir -p .tmp`) with the header fields and the chosen `transaction_id`. See "`receipt.json`" below.

3. **Load context.** Read `rules.md` for the user's categorization rules. Run `./scripts/list-categories.js` to get valid categories with ids — only propose categories from its output, and use names exactly as printed. If `YNAB_TOKEN` is unset the script exits with a message; ask the user to set it rather than guessing.

4. **Categorize.** For each line, try in order:
   - Rule match in `rules.md` → confident
   - Obvious from the item name (MILK 2%, BREAD WHEAT) → confident
   - Inferred from merchant/surrounding items → uncertain, note reasoning
   - Web search for cryptic names (HONEY GOAT, JELLY CUBE) → confident if resolved, else uncertain
   - Nothing works → unknown, propose a best guess

5. **Build `line_items` in `.tmp/receipt.json`.** One entry per receipt line, in receipt order:
   - `printed`: the description exactly as printed (`GV RF 2 HG`).
   - `name`: what it is, as a person would say it (`2% milk, half gallon`). This is what ends up in the YNAB memo.
   - `price`: the printed price as a string (`"1.52"`).
   - `tax_rate`: the percent rate that applied to this line as a string (`"7"`, `"9"`, `"0"` if untaxed). If the receipt does not say which rate applied to which item, use the overall effective rate for every line: `tax ÷ subtotal × 100`, kept to four decimals.
   - `category_name`: the proposed category, exactly as printed by `list-categories.js`.
   - `confidence`: `confident`, `uncertain`, or `unknown`.
   - `note`: identification and reasoning, one sentence. Required for `uncertain` and `unknown`.

6. **Fold into `subtransactions`.** Follow "Folding" below exactly. One leg per distinct `category_name`, tax included, whole cents. Verify the legs sum to the receipt total before going on.

7. **Write `.tmp/receipt.md` alongside it** in the format below. This is the review surface.

8. **Open for review:** `code-insiders --wait .tmp/receipt.md`. Runs in the foreground; do not time it out. If `code-insiders` isn't on PATH, say so and take corrections in chat instead.

9. **Reconcile md → line_items → legs.** Read the edited md and apply each change to `line_items`: changed category name → update `category_name` (must be in the category list; ask if it is not or is ambiguous); deleted line → drop the item; edited price → update `price`; prose notes from the user → follow them, asking if they could apply to more than one item. Then regenerate `subtransactions` from `line_items` from scratch by repeating step 6. Never hand-edit a leg. Interrupt and ask rather than guess when the items no longer sum to the receipt subtotal.

10. **Confirm.** Show the final legs, one bullet per leg with category, dollar amount, and memo, and get an explicit go-ahead before step 11.

11. **Apply.** Run `./scripts/update-transaction.js .tmp/receipt.json`. It reads only `transaction_id` and `subtransactions`; `line_items` and the header keys are ignored. It sets the parent's category to null (required for a split) and sends the legs to YNAB. On success it prints the updated transaction as JSON; report the split to the user and delete `.tmp/receipt.json` and `.tmp/receipt.md`. On failure it prints the reason and exits non-zero:
    - A validation error names the offending field (`→ at subtransactions[2].amount`); fix the file and rerun.
    - A YNAB error (`YNAB 400 ...`) usually means the legs do not sum to the transaction amount, or the transaction is already split. Show the message to the user; do not retry unchanged.

    YNAB leaves a transaction unapproved after an update that does not set `approved`. Tell the user the split may need approving in YNAB.

## Folding

Do all arithmetic in whole cents on the digits of the printed strings. Never multiply decimals in floating point.

1. **Group** `line_items` by `category_name`, keeping the order in which each category first appears on the receipt.
2. **Items** per category: sum of `price`.
3. **Tax** per category: sum over its items of `price × tax_rate`, rounded to the nearest cent. When every line carries the effective rate this is the same as `tax × (category items ÷ subtotal)`.
4. **Total** per category: items + tax.
5. **Balance.** Sum every category total and compare to the receipt total. A difference of a cent or two is rounding; put the whole difference on the category with the largest item total so the legs sum exactly. A larger difference means a misread price or tax; fix the line items instead.
6. **Emit one leg per category:**
   - `category_id`: the id for `category_name` from `list-categories.js`.
   - `memo`: the `name` of each item in the group, comma-separated, in receipt order (`Head & Shoulders, Conair brush`). Cap at 500 characters; if a group would exceed it, shorten names rather than dropping items.
   - `amount`: the category total as negative milliunits. Whole cents, so it always ends in `0`.
7. **Check before every write:** `sum(amount) === -(receipt total in milliunits)`.

Worked example. Receipt: `$13.68` avocado oil (🍗 Food - Personal, `F` flag, 7%), `$16.46` beer (🍱 Entertainment, 9%), subtotal `$30.14`, tax `$2.44`, total `$32.58`. Food tax is `13.68 × 7% = 0.9576 → $0.96`; Entertainment tax is `16.46 × 9% = 1.4814 → $1.48`. Category totals are `$14.64` and `$17.94`, which sum to `$32.58`, so no balancing is needed. The legs are `{ memo: "Avocado oil", amount: -14640 }` and `{ memo: "Beer", amount: -17940 }`. Had the totals summed to `$32.57`, Entertainment, the larger group, would take the extra cent and become `-17950`.

## Milliunits

YNAB amounts are integers in milliunits: 1 dollar = 1000 milliunits, 1 cent = 10.

- Convert by moving the decimal point three places, padding with zeros. `$1.29` → `1290`, `$13.68` → `13680`, `$94` → `94000`, `$0.50` → `500`.
- Outflows are negative. A `$1.29` purchase is `-1290`. Every leg on a receipt split is negative.
- Folded legs are whole cents, so every `amount` ends in `0`. An amount that does not is a folding error.

## `receipt.json`

`update-transaction.js` reads only `transaction_id` and `subtransactions`. `line_items` is the working set for categorization and review; the legs are derived from it and regenerated whenever it changes. Header fields exist for the review file. This is the exact shape:

```json
{
  "transaction_id": "6e7c2a1e-1b6b-4c0e-9c1f-3d2a5b8f9a10",
  "merchant": "Walmart, Madison AL",
  "date": "2026-08-28",
  "total": "32.58",
  "subtotal": "30.14",
  "tax": "2.44",
  "payment": "Amex 1000",
  "line_items": [
    { "printed": "GV AVO OIL", "name": "Avocado oil", "price": "13.68", "tax_rate": "7", "category_name": "🍗 Food - Personal", "confidence": "confident", "note": "Great Value avocado oil" },
    { "printed": "MICHELOB UL", "name": "Beer", "price": "16.46", "tax_rate": "9", "category_name": "🍱 Entertainment", "confidence": "confident", "note": "Michelob Ultra; alcohol rule" }
  ],
  "subtransactions": [
    { "category_id": "a1b2c3d4-0000-4000-8000-000000000001", "memo": "Avocado oil", "amount": -14640 },
    { "category_id": "a1b2c3d4-0000-4000-8000-000000000002", "memo": "Beer", "amount": -17940 }
  ]
}
```

Rules the script enforces on the keys it reads:
- `transaction_id`: non-empty string. The id from step 2.
- `subtransactions`: at least one leg.
- `category_id`: non-empty string. An id from `list-categories.js`.
- `memo`: non-empty string, at most 500 characters. Required on every leg.
- `amount`: integer. Negative milliunits, no decimals — `-14640`, never `-14.64` or `"-14640"`.

Header fields (`total`, `subtotal`, `tax`) and every `price` and `tax_rate` are strings as printed, so cents are never lost to float formatting.

## Output format

Markdown, headings and unordered lists only. No tables — bullets edit more easily.

```markdown
# <Merchant> — <YYYY-MM-DD>

- Merchant: <name, location>
- Date: <date and time>
- Total: $<total> (subtotal $<subtotal>, tax $<tax>)
- Payment: <method, if visible>
- Transaction: <payee> on <date>, `<transaction_id>`

## Attention needed

- ❓ **<printed>** — $<price> → <Category>
  - <what it might be; what to check>
- ⚠️ **<printed>** — $<price> → <Category>
  - <identification and doubt>

## Confident

- **<printed>** — $<price> → <Category>
  - <name>

## Legs

- <Category>: $<items> + $<tax> tax = $<total>
  - <memo>
- Sum: $<total> (matches receipt)
```

- Every line item appears once, headed by its printed description. Unknown → ❓ under Attention needed; uncertain → ⚠️; confident → under Confident. Receipt order within each section.
- If Attention needed is empty, write "- None".
- Cross-item notes (e.g. a category split to consider merging) go at the end of Attention needed.
- Prices are the printed item prices; tax appears only under Legs. Legs mirror `subtransactions` one for one, with the memo the user will see in YNAB as the nested bullet.

## Scripts

Scripts live in `./scripts/`. Run with `node`. All require `YNAB_TOKEN` in the environment and exit non-zero with a message if it is unset. All use the last-used plan.

- `./scripts/find-transactions-by-total.js <total>` — lists outflows from the last three months whose amount equals `total` (as printed: `94.02`, `$1,234.56`), as markdown, newest first. Each bullet has date, payee, account, category, and the id in backticks; nested bullets give cleared/approved state, memo, and ⚠️ flags for already-split transactions and transfers. Prints `- None` when nothing matches. Exits non-zero only on a malformed total.
- `./scripts/list-categories.js [plan-id]` — prints categories as markdown, one heading per group, one bullet per category with its id. Hidden/internal/deleted omitted. `plan-id` defaults to `last-used`.
- `./scripts/update-transaction.js <receipt.json>` — splits the transaction named in the file into its `subtransactions`. Validates the file first and names the offending field on failure. Prints the updated transaction and server knowledge as JSON on success.
