import { z } from "zod";

import type { ExistingTransaction } from "./types.js";

/** One split leg, as written by the split-receipt skill: one per category, items folded. */
export const UpdateSubtransaction = z.object({
  /** YNAB category UUID. */
  category_id: z.string().min(1),
  /** Human-readable list of the items in this leg. YNAB caps memos at 500 characters. */
  memo: z.string().min(1).max(500),
  /** Milliunits, negative for outflow: -1290 is $1.29 spent. */
  amount: z.int(),
});

/** The JSON file the update-transaction script reads. Unknown keys such as the skill's `line_items` are dropped. */
export const UpdatePayload = z.object({
  /** YNAB transaction UUID. */
  transaction_id: z.string().min(1),
  /** One entry per split leg, one leg per category. Amounts must sum to the transaction's amount. */
  subtransactions: z.array(UpdateSubtransaction).min(1),
});

export type UpdateSubtransaction = z.infer<typeof UpdateSubtransaction>;
export type UpdatePayload = z.infer<typeof UpdatePayload>;

/**
 * Builds the PUT body that turns the payload's transaction into a split. The
 * parent's category is nulled because YNAB rejects subtransactions on a
 * categorized parent.
 */
export function toSplitTransaction(payload: UpdatePayload): ExistingTransaction {
  return { category_id: null, subtransactions: payload.subtransactions };
}
