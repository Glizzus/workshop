// Wire types for the YNAB API, transcribed from its OpenAPI spec
// (https://api.ynab.com/papi/open_api_spec.yaml). Field names are YNAB's, not
// ours -- see the README.

/** The cleared status of a transaction. */
export type TransactionClearedStatus = "cleared" | "uncleared" | "reconciled";

/** The transaction flag. An empty string means "no flag", same as null. */
export type TransactionFlagColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | ""
  | null;

/** If the transaction is a debt/loan account transaction, the type of transaction. */
export type DebtTransactionType =
  | "payment"
  | "refund"
  | "fee"
  | "interest"
  | "escrow"
  | "balanceAdjustment"
  | "credit"
  | "charge"
  | null;

/** One leg of a split transaction. */
export interface SubTransaction {
  id: string;
  transaction_id: string;
  /** The subtransaction amount in milliunits format. */
  amount: number;
  memo?: string | null;
  payee_id?: string | null;
  payee_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  /** If a transfer, the account_id which the subtransaction transfers to. */
  transfer_account_id?: string | null;
  /** If a transfer, the id of transaction on the other side of the transfer. */
  transfer_transaction_id?: string | null;
  /** Deleted subtransactions will only be included in delta requests. */
  deleted: boolean;
  /** The subtransaction amount formatted in the plan's currency format. */
  amount_formatted?: string;
  /** The subtransaction amount as a decimal currency amount. */
  amount_currency?: number;
}

/** A transaction as returned by the transactions endpoints. */
export interface TransactionDetail {
  id: string;
  /** The transaction date in ISO format (e.g. 2016-12-01). */
  date: string;
  /** The transaction amount in milliunits format. */
  amount: number;
  memo?: string | null;
  cleared: TransactionClearedStatus;
  /** Whether or not the transaction is approved. */
  approved: boolean;
  flag_color?: TransactionFlagColor;
  flag_name?: string | null;
  account_id: string;
  payee_id?: string | null;
  category_id?: string | null;
  /** If a transfer transaction, the account to which it transfers. */
  transfer_account_id?: string | null;
  /** If a transfer transaction, the id of transaction on the other side of the transfer. */
  transfer_transaction_id?: string | null;
  /** If transaction is matched, the id of the matched transaction. */
  matched_transaction_id?: string | null;
  /**
   * If the transaction was imported, this field is a unique (by account) import
   * identifier. Imports not made through the API use the format
   * 'YNAB:[milliunit_amount]:[iso_date]:[occurrence]'.
   */
  import_id?: string | null;
  /** If imported, the payee name used when importing, before any rename rules. */
  import_payee_name?: string | null;
  /** If imported, the original payee name as it appeared on the statement. */
  import_payee_name_original?: string | null;
  debt_transaction_type?: DebtTransactionType;
  /** Deleted transactions will only be included in delta requests. */
  deleted: boolean;
  /** The transaction amount formatted in the plan's currency format. */
  amount_formatted?: string;
  /** The transaction amount as a decimal currency amount. */
  amount_currency?: number;
  account_name: string;
  payee_name?: string | null;
  /** The name of the category. If a split transaction, this will be 'Split'. */
  category_name?: string | null;
  /** If a split transaction, the subtransactions. */
  subtransactions: SubTransaction[];
}

/** The `data` member of a successful GET /plans/{plan_id}/transactions response. */
export interface TransactionsData {
  transactions: TransactionDetail[];
  /** The knowledge of the server. */
  server_knowledge: number;
}

/** Successful response envelope for GET /plans/{plan_id}/transactions. */
export interface TransactionsResponse {
  data: TransactionsData;
}

/** The `error` member of every non-2xx response. */
export interface ErrorDetail {
  id: string;
  name: string;
  detail: string;
}

/** Error response envelope, returned with any non-2xx status. */
export interface ErrorResponse {
  error: ErrorDetail;
}

/** One leg of a split, as sent when saving a transaction. */
export interface SaveSubTransaction {
  /** The subtransaction amount in milliunits format. */
  amount: number;
  /** The payee for the subtransaction. */
  payee_id?: string | null;
  /**
   * The payee name. If provided while `payee_id` is null, YNAB resolves it by
   * (1) a matching rename rule (only if import_id is set on the parent), (2) a
   * payee with the same name, or (3) creating a new payee. Max 200 chars.
   */
  payee_name?: string | null;
  /** The category for the subtransaction. Credit Card Payment categories are ignored. */
  category_id?: string | null;
  /** Max 500 chars. */
  memo?: string | null;
}

/**
 * Fields accepted by PUT /plans/{plan_id}/transactions/{transaction_id}. Every
 * field is optional; omitted fields are left unchanged.
 */
export interface ExistingTransaction {
  account_id?: string;
  /**
   * ISO date, e.g. 2016-12-01. Future dates are not permitted. Split
   * transaction dates cannot be changed; a different date is ignored.
   */
  date?: string;
  /**
   * The transaction amount in milliunits format. Split transaction amounts
   * cannot be changed; a different amount is ignored.
   */
  amount?: number;
  /**
   * The payee. To create a transfer between two accounts, use the account
   * transfer payee pointing to the target account (`transfer_payee_id` on the
   * account resource).
   */
  payee_id?: string | null;
  /** Resolved the same way as {@link SaveSubTransaction.payee_name}. Max 200 chars. */
  payee_name?: string | null;
  /**
   * The category. To configure a split, set this to null and provide
   * `subtransactions`. If the transaction is already a split, the category
   * cannot be changed. Credit Card Payment categories are ignored.
   */
  category_id?: string | null;
  /** Max 500 chars. */
  memo?: string | null;
  cleared?: TransactionClearedStatus;
  /** If not supplied, the transaction is unapproved by default. */
  approved?: boolean;
  flag_color?: TransactionFlagColor;
  /**
   * Subtransactions to configure the transaction as a split. Updating
   * `subtransactions` on an existing split is not supported and returns an
   * error. Splits are not allowed on tracking accounts or on transfers between
   * on-budget accounts; a transfer to a tracking account can be a split.
   */
  subtransactions?: SaveSubTransaction[];
}

/** Request body for PUT /plans/{plan_id}/transactions/{transaction_id}. */
export interface PutTransactionWrapper {
  transaction: ExistingTransaction;
}

/** The `data` member of a successful single-transaction response. */
export interface TransactionData {
  transaction: TransactionDetail;
  /** The knowledge of the server. */
  server_knowledge: number;
}

/** Successful response envelope for single-transaction endpoints. */
export interface TransactionResponse {
  data: TransactionData;
}

/**
 * The type of goal, if the category has one. TB = Target Category Balance,
 * TBD = Target Category Balance by Date, MF = Monthly Funding, NEED = Plan
 * Your Spending.
 */
export type GoalType = "TB" | "TBD" | "MF" | "NEED" | "DEBT" | null;

/**
 * A category. Amounts (assigned, activity, available, etc.) are specific to
 * the current plan month (UTC).
 */
export interface Category {
  id: string;
  category_group_id: string;
  category_group_name?: string;
  name: string;
  /** Whether or not the category is hidden. */
  hidden: boolean;
  /** Whether or not the category is internal. */
  internal: boolean;
  /** DEPRECATED: No longer used. Value will always be null. */
  original_category_group_id?: string | null;
  note?: string | null;
  /** Assigned (budgeted) amount in milliunits format. */
  budgeted: number;
  /** Activity amount in milliunits format. */
  activity: number;
  /** Available balance in milliunits format. */
  balance: number;
  goal_type?: GoalType;
  /**
   * Monthly rollover behavior for "NEED"-type goals: true always asks for the
   * target amount in the new month ("Set Aside"), false reuses previous month
   * funding ("Refill"). Null for other goal types.
   */
  goal_needs_whole_amount?: boolean | null;
  /**
   * Day offset for the goal's due date. When goal_cadence is 2 (Weekly), the
   * day of the week (0 = Sunday, 6 = Saturday). Otherwise the day of the month
   * (1-31, null = last day of month).
   */
  goal_day?: number | null;
  /**
   * Goal cadence, 0-14. For 0, 1, 2, and 13 the due date repeats every
   * goal_cadence * goal_cadence_frequency, where 0 = None, 1 = Monthly,
   * 2 = Weekly, 13 = Yearly. For 3-12 and 14 the frequency is ignored and the
   * due date repeats every goal_cadence, where 3 = Every 2 Months ...
   * 12 = Every 11 Months, and 14 = Every 2 Years.
   */
  goal_cadence?: number | null;
  /** Multiplier for goal_cadence 0, 1, 2, or 13; ignored otherwise. */
  goal_cadence_frequency?: number | null;
  /** The month a goal was created, ISO date. */
  goal_creation_month?: string | null;
  /** The goal target amount in milliunits. */
  goal_target?: number | null;
  /** DEPRECATED: No longer used. Use `goal_target_date` instead. */
  goal_target_month?: string | null;
  /** The target date for the goal to be completed. Only some goal types specify this. */
  goal_target_date?: string | null;
  /** The percentage completion of the goal. */
  goal_percentage_complete?: number | null;
  /** Months, including the current month, left in the current goal period. */
  goal_months_to_budget?: number | null;
  /** Funding still needed in the current month to stay on track, in milliunits. */
  goal_under_funded?: number | null;
  /** Total funded towards the goal within the current goal period, in milliunits. */
  goal_overall_funded?: number | null;
  /** Funding still needed to complete the goal within the current goal period, in milliunits. */
  goal_overall_left?: number | null;
  /** The date/time the goal was snoozed, or null if not snoozed. */
  goal_snoozed_at?: string | null;
  /** Deleted categories will only be included in delta requests. */
  deleted: boolean;
  /** Available balance formatted in the plan's currency format. */
  balance_formatted?: string;
  /** Available balance as a decimal currency amount. */
  balance_currency?: number;
  /** Activity formatted in the plan's currency format. */
  activity_formatted?: string;
  /** Activity as a decimal currency amount. */
  activity_currency?: number;
  /** Assigned (budgeted) amount formatted in the plan's currency format. */
  budgeted_formatted?: string;
  /** Assigned (budgeted) amount as a decimal currency amount. */
  budgeted_currency?: number;
  goal_target_formatted?: string | null;
  goal_target_currency?: number | null;
  goal_under_funded_formatted?: string | null;
  goal_under_funded_currency?: number | null;
  goal_overall_funded_formatted?: string | null;
  goal_overall_funded_currency?: number | null;
  goal_overall_left_formatted?: string | null;
  goal_overall_left_currency?: number | null;
}

/** A category group. */
export interface CategoryGroup {
  id: string;
  name: string;
  /** Whether or not the category group is hidden. */
  hidden: boolean;
  /** Whether or not the category group is internal. */
  internal: boolean;
  /** Deleted category groups will only be included in delta requests. */
  deleted: boolean;
}

/** A category group together with its categories. */
export interface CategoryGroupWithCategories extends CategoryGroup {
  /** Amounts on each category are specific to the current plan month (UTC). */
  categories: Category[];
}

/** The `data` member of a successful GET /plans/{plan_id}/categories response. */
export interface CategoriesData {
  category_groups: CategoryGroupWithCategories[];
  /** The knowledge of the server. */
  server_knowledge: number;
}

/** Successful response envelope for GET /plans/{plan_id}/categories. */
export interface CategoriesResponse {
  data: CategoriesData;
}
